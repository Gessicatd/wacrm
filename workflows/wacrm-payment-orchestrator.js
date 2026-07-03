import {
  workflow,
  node,
  trigger,
  switchCase,
  sticky,
  expr,
  placeholder,
  newCredential,
} from "@n8n/workflow-sdk";

// ============================================================
// WACRM Payment Orchestrator
//
// Receives webhooks from wacrm automations and routes to the
// correct action: generate payment, check status, send media.
//
// wacrm automations use the "send_webhook" step to POST here
// with body: { action, contact, conversation, message, ... }
//
// Setup:
//   1. Create an API key in wacrm (Settings → API Keys)
//      with scope messages:send
//   2. In n8n, create credentials:
//      - "WACRM API" (Header Auth) → key: Authorization,
//        value: Bearer <sua_wacrm_api_key>
//      - "Gateway Pagamento" (Bearer Auth) → seu token
//   3. Update payment_gateway_url placeholder
// ============================================================

// --------------------------------------------------
// WEBHOOK TRIGGER
// --------------------------------------------------

const webhook = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2.1,
  config: {
    name: "Webhook (wacrm)",
    parameters: {
      httpMethod: "POST",
      path: "wacrm-payment",
      responseMode: "lastNode",
      options: { responseCode: { values: { responseCode: 200 } } },
    },
    position: [240, 300],
  },
  output: [
    {
      body: {
        action: "",
        contact: { id: "", name: "", phone: "" },
        conversation: { id: "" },
        data: {},
      },
    },
  ],
});

// --------------------------------------------------
// EXTRACT AND NORMALIZE
// --------------------------------------------------

const extract = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Extract Data",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: "action", name: "action", value: expr("{{ $('Webhook (wacrm)').item.json.body.action }}"), type: "string" },
          { id: "contact_id", name: "contact_id", value: expr("{{ $('Webhook (wacrm)').item.json.body.contact.id }}"), type: "string" },
          { id: "contact_name", name: "contact_name", value: expr("{{ $('Webhook (wacrm)').item.json.body.contact.name }}"), type: "string" },
          { id: "contact_phone", name: "contact_phone", value: expr("{{ $('Webhook (wacrm)').item.json.body.contact.phone }}"), type: "string" },
          { id: "conversation_id", name: "conversation_id", value: expr("{{ $('Webhook (wacrm)').item.json.body.conversation.id }}"), type: "string" },
          { id: "custom_data", name: "custom_data", value: expr("{{ $('Webhook (wacrm)').item.json.body.data }}"), type: "object" },
        ],
      },
    },
    position: [540, 300],
  },
  output: [
    {
      action: "",
      contact_id: "",
      contact_name: "",
      contact_phone: "",
      conversation_id: "",
      custom_data: {},
    },
  ],
});

// --------------------------------------------------
// ROUTE BY ACTION (Switch)
// --------------------------------------------------

const router = switchCase({
  version: 3.4,
  config: {
    name: "Route by Action",
    parameters: {
      mode: "rules",
      rules: {
        values: [
          {
            conditions: {
              combinator: "and",
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
              },
              conditions: [
                {
                  leftValue: expr("{{ $('Extract Data').item.json.action }}"),
                  rightValue: "generate_charge",
                  operator: { type: "string", operation: "equals" },
                },
              ],
            },
            renameOutput: true,
            outputKey: "Gerar Cobrança",
          },
          {
            conditions: {
              combinator: "and",
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
              },
              conditions: [
                {
                  leftValue: expr("{{ $('Extract Data').item.json.action }}"),
                  rightValue: "check_payment",
                  operator: { type: "string", operation: "equals" },
                },
              ],
            },
            renameOutput: true,
            outputKey: "Verificar Pagamento",
          },
          {
            conditions: {
              combinator: "and",
              options: {
                caseSensitive: true,
                leftValue: "",
                typeValidation: "strict",
              },
              conditions: [
                {
                  leftValue: expr("{{ $('Extract Data').item.json.action }}"),
                  rightValue: "send_media",
                  operator: { type: "string", operation: "equals" },
                },
              ],
            },
            renameOutput: true,
            outputKey: "Enviar Mídia",
          },
        ],
      },
      options: {
        fallbackOutput: "extra",
      },
    },
    position: [840, 300],
  },
  output: [{ action: "generate_charge" }, { action: "check_payment" }, { action: "send_media" }, {}],
});

// ============================================================
// BRANCH 1: generate_charge
// ============================================================

const chargeApi = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Criar Cobrança",
    parameters: {
      method: "POST",
      url: placeholder("https://api.asaas.com/v3/payments"),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Content-Type", value: "application/json" },
        ],
      },
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '{\n' +
        '  "customer": "{{ $("Extract Data").item.json.contact_name }}",\n' +
        '  "value": {{ $("Extract Data").item.json.custom_data.amount }},\n' +
        '  "description": "{{ $("Extract Data").item.json.custom_data.description }}"\n' +
        '}',
      ),
      options: {
        timeout: 15000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: { httpBearerAuth: newCredential("Gateway Pagamento") },
    executeOnce: true,
    position: [1140, 100],
  },
  output: [
    {
      id: "",
      invoiceUrl: "",
      pixQrCode: "",
      pixCopyPaste: "",
      bankSlipUrl: "",
      barcode: "",
      status: "",
    },
  ],
});

const sendChargeToWacrm = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Enviar Link p/ Cliente",
    parameters: {
      method: "POST",
      url: placeholder("https://crm.seudominio.com/api/v1/messages"),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Content-Type", value: "application/json" },
        ],
      },
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '{\n' +
        '  "to": "{{ $("Extract Data").item.json.contact_phone }}",\n' +
        '  "text": "Segue seu link de pagamento:\n{{ $json.invoiceUrl }}"\n' +
        '}',
      ),
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: { httpHeaderAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1440, 100],
  },
  output: [{ data: {} }],
});

// ============================================================
// BRANCH 2: check_payment
// ============================================================

const paymentStatus = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Consultar Status Pagamento",
    parameters: {
      method: "GET",
      url: placeholder("https://api.asaas.com/v3/payments/{payment_id}"),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Content-Type", value: "application/json" },
        ],
      },
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: { httpBearerAuth: newCredential("Gateway Pagamento") },
    executeOnce: true,
    position: [1140, 300],
  },
  output: [{ id: "", status: "", paidDate: "" }],
});

const notifyPaymentConfirmed = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Notificar Cliente",
    parameters: {
      method: "POST",
      url: placeholder("https://crm.seudominio.com/api/v1/messages"),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Content-Type", value: "application/json" },
        ],
      },
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '{\n' +
        '  "to": "{{ $("Extract Data").item.json.contact_phone }}",\n' +
        '  "text": "Pagamento confirmado! Obrigado pela compra 🎉"\n' +
        '}',
      ),
      options: {
        timeout: 10000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: { httpHeaderAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1440, 300],
  },
  output: [{ data: {} }],
});

// ============================================================
// BRANCH 3: send_media
// ============================================================

const sendMediaToWacrm = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Enviar Mídia",
    parameters: {
      method: "POST",
      url: placeholder("https://crm.seudominio.com/api/v1/messages"),
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Content-Type", value: "application/json" },
        ],
      },
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '{\n' +
        '  "to": "{{ $("Extract Data").item.json.contact_phone }}",\n' +
        '  "media_type": "{{ $("Extract Data").item.json.custom_data.media_type }}",\n' +
        '  "media_url": "{{ $("Extract Data").item.json.custom_data.media_url }}"\n' +
        '}',
      ),
      options: {
        timeout: 15000,
        response: { response: { responseFormat: "json" } },
      },
    },
    credentials: { httpHeaderAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1140, 500],
  },
  output: [{ data: {} }],
});

// ============================================================
// COMPOSE WORKFLOW
// ============================================================

export default workflow(
  "wacrm-payment-orchestrator",
  "WACRM - Orquestrador de Pagamentos",
)
  .add(sticky("## WACRM - Orquestrador de Pagamentos\n\nRecebe webhooks do wacrm e executa ações:\n- **generate_charge**: Cria cobrança no Asaas/MP e envia link\n- **check_payment**: Verifica status e notifica cliente\n- **send_media**: Envia mídia via wacrm API\n\n### Antes de ativar:\n1. Crie credenciais \"WACRM API\" (Header Auth) e \"Gateway Pagamento\" (Bearer Auth)\n2. Atualize a URL do wacrm no placeholder\n3. Configure a automação no wacrm com step send_webhook"))

  .add(webhook)
  .to(extract)
  .to(
    router
      .onCase(0, chargeApi.to(sendChargeToWacrm))
      .onCase(1, paymentStatus.to(notifyPaymentConfirmed))
      .onCase(2, sendMediaToWacrm),
  );
