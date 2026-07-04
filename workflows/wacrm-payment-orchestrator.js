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
// WACRM - ORQUESTRADOR DE PAGAMENTOS
//
// Recebe webhooks das automacoes do wacrm e roteia acoes:
//   generate_charge - criar cobranca na gateway + enviar link
//   check_payment   - verificar status + notificar cliente
//   send_media      - enviar midia via wacrm API
// ============================================================

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
  output: [{ body: { action: "", contact: { id: "", name: "", phone: "" }, conversation: { id: "" }, data: {} } }],
});

const extract = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Normalizar Dados",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: "a", name: "action", value: expr("{{ $('Webhook (wacrm)').item.json.body.action }}"), type: "string" },
          { id: "b", name: "contact_id", value: expr("{{ $('Webhook (wacrm)').item.json.body.contact.id }}"), type: "string" },
          { id: "c", name: "contact_name", value: expr("{{ $('Webhook (wacrm)').item.json.body.contact.name }}"), type: "string" },
          { id: "d", name: "contact_phone", value: expr("{{ $('Webhook (wacrm)').item.json.body.contact.phone }}"), type: "string" },
          { id: "e", name: "conversation_id", value: expr("{{ $('Webhook (wacrm)').item.json.body.conversation.id }}"), type: "string" },
          { id: "f", name: "custom_data", value: expr("{{ $('Webhook (wacrm)').item.json.body.data }}"), type: "object" },
        ],
      },
    },
    position: [540, 300],
  },
  output: [{ action: "", contact_id: "", contact_name: "", contact_phone: "", conversation_id: "", custom_data: {} }],
});

const router = switchCase({
  version: 3.4,
  config: {
    name: "Roteador",
    parameters: {
      mode: "rules",
      rules: {
        values: [
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
              conditions: [{ leftValue: expr("{{ $('Normalizar Dados').item.json.action }}"), rightValue: "generate_charge", operator: { type: "string", operation: "equals" } }],
            },
            renameOutput: true, outputKey: "Gerar Cobranca",
          },
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
              conditions: [{ leftValue: expr("{{ $('Normalizar Dados').item.json.action }}"), rightValue: "check_payment", operator: { type: "string", operation: "equals" } }],
            },
            renameOutput: true, outputKey: "Verificar Pagamento",
          },
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
              conditions: [{ leftValue: expr("{{ $('Normalizar Dados').item.json.action }}"), rightValue: "send_media", operator: { type: "string", operation: "equals" } }],
            },
            renameOutput: true, outputKey: "Enviar Midia",
          },
        ],
      },
      options: { fallbackOutput: "extra" },
    },
    position: [840, 300],
  },
  output: [{}, {}, {}, {}],
});

// ============================================================
// BRANCH 1: generate_charge
// ============================================================

const chargeApi = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Criar Cobranca na Gateway",
    parameters: {
      method: "POST",
      url: placeholder("https://api.asaas.com/v3/payments"),
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '{\n' +
        '  "customer": "{{ $("Normalizar Dados").item.json.contact_name }}",\n' +
        '  "value": {{ $("Normalizar Dados").item.json.custom_data.amount }},\n' +
        '  "description": "{{ $("Normalizar Dados").item.json.custom_data.description }}"\n' +
        '}',
      ),
      options: { timeout: 15000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("Gateway Pagamento") },
    executeOnce: true,
    position: [1140, 50],
  },
  output: [{ id: "", invoiceUrl: "", pixQrCode: "", pixCopyPaste: "", bankSlipUrl: "", barcode: "", status: "" }],
});

const sendChargeToWacrm = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Enviar Link pro Cliente",
    parameters: {
      method: "POST",
      url: placeholder("https://crm.seudominio.com/api/v1/messages"),
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '{\n' +
        '  "to": "{{ $("Normalizar Dados").item.json.contact_phone }}",\n' +
        '  "text": "Segue seu link de pagamento:\n{{ $("Criar Cobranca na Gateway").item.json.invoiceUrl }}"\n' +
        '}',
      ),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpHeaderAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1440, 50],
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
    name: "Consultar Status na Gateway",
    parameters: {
      method: "GET",
      url: placeholder("https://api.asaas.com/v3/payments/{payment_id}"),
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("Gateway Pagamento") },
    executeOnce: true,
    position: [1140, 200],
  },
  output: [{ id: "", status: "", paidDate: "" }],
});

const notifyPaymentConfirmed = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Notificar Confirmacao",
    parameters: {
      method: "POST",
      url: placeholder("https://crm.seudominio.com/api/v1/messages"),
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '{\n' +
        '  "to": "{{ $("Normalizar Dados").item.json.contact_phone }}",\n' +
        '  "text": "Pagamento confirmado! Obrigado pela compra 🎉"\n' +
        '}',
      ),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpHeaderAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1440, 200],
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
    name: "Enviar Midia",
    parameters: {
      method: "POST",
      url: placeholder("https://crm.seudominio.com/api/v1/messages"),
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr(
        '{\n' +
        '  "to": "{{ $("Normalizar Dados").item.json.contact_phone }}",\n' +
        '  "media_type": "{{ $("Normalizar Dados").item.json.custom_data.media_type }}",\n' +
        '  "media_url": "{{ $("Normalizar Dados").item.json.custom_data.media_url }}"\n' +
        '}',
      ),
      options: { timeout: 15000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpHeaderAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1140, 350],
  },
  output: [{ data: {} }],
});

export default workflow("wacrm-payment-orchestrator", "WACRM - Orquestrador de Pagamentos")
  .add(sticky("## WACRM - Orquestrador de Pagamentos\n\nRecebe webhooks do wacrm e roteia acoes:\n- **generate_charge**: Cria cobranca na API de pagamento e envia link via WhatsApp\n- **check_payment**: Consulta status na gateway e notifica cliente\n- **send_media**: Envia midia (imagem, video, documento) via wacrm API"))
  .add(webhook)
  .to(extract)
  .to(router
    .onCase(0, chargeApi.to(sendChargeToWacrm))
    .onCase(1, paymentStatus.to(notifyPaymentConfirmed))
    .onCase(2, sendMediaToWacrm),
  );
