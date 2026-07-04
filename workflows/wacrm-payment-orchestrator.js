import {
  workflow,
  node,
  trigger,
  switchCase,
  ifElse,
  sticky,
  expr,
  placeholder,
  newCredential,
} from "@n8n/workflow-sdk";

const webhook = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2.1,
  config: {
    name: "Webhook wacrm",
    parameters: {
      httpMethod: "POST",
      path: "wacrm-payment",
      responseMode: "lastNode",
      options: { responseCode: { values: { responseCode: 200 } } },
    },
    position: [240, 300],
  },
  output: [{ query: { action: "", amount: "", description: "", media_url: "", media_type: "" }, body: { message_text: "", conversation_id: "" } }],
});

// ============================================================
// FETCH CONVERSATION + CONTACT
// ============================================================

const fetchConversation = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Buscar Conversa (API)",
    parameters: {
      method: "GET",
      url: expr('https://wacrm.autofunil.com.br/api/v1/conversations/{{ $("Webhook wacrm").item.json.body.conversation_id }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [540, 300],
  },
  output: [{ data: { id: "", contact_id: "", status: "" } }],
});

const fetchContact = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Buscar Contato (API)",
    parameters: {
      method: "GET",
      url: expr('https://wacrm.autofunil.com.br/api/v1/contacts/{{ $("Buscar Conversa (API)").item.json.data.contact_id }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [840, 300],
  },
  output: [{ data: { id: "", name: "", phone: "" } }],
});

const normalize = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Normalizar Dados",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: "a", name: "action", value: expr("{{ $('Webhook wacrm').item.json.query.action }}"), type: "string" },
          { id: "b", name: "contact_name", value: expr("{{ $('Buscar Contato (API)').item.json.data.name }}"), type: "string" },
          { id: "c", name: "contact_phone", value: expr("{{ $('Buscar Contato (API)').item.json.data.phone }}"), type: "string" },
          { id: "d", name: "contact_id", value: expr("{{ $('Buscar Contato (API)').item.json.data.id }}"), type: "string" },
          { id: "e", name: "conversation_id", value: expr("{{ $('Webhook wacrm').item.json.body.conversation_id }}"), type: "string" },
          { id: "f", name: "message_text", value: expr("{{ $('Webhook wacrm').item.json.body.message_text }}"), type: "string" },
          { id: "g", name: "amount", value: expr("{{ $('Webhook wacrm').item.json.query.amount }}"), type: "number" },
          { id: "h", name: "description", value: expr("{{ $('Webhook wacrm').item.json.query.description }}"), type: "string" },
          { id: "i", name: "media_url", value: expr("{{ $('Webhook wacrm').item.json.query.media_url }}"), type: "string" },
          { id: "j", name: "media_type", value: expr("{{ $('Webhook wacrm').item.json.query.media_type }}"), type: "string" },
        ],
      },
    },
    position: [1140, 300],
  },
  output: [{ action: "", contact_name: "", contact_phone: "", amount: 0, description: "", media_url: "", media_type: "" }],
});

// ============================================================
// ROUTER
// ============================================================

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
    position: [1440, 300],
  },
  output: [{}, {}, {}, {}],
});

// ============================================================
// BRANCH A: generate_charge
// ============================================================

const chargeApi = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Criar Cobranca (MP)",
    parameters: {
      method: "POST",
      url: "https://api.mercadopago.com/checkout/preferences",
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr('{\n  "items": [{\n    "title": "{{ $("Normalizar Dados").item.json.description }}",\n    "quantity": 1,\n    "unit_price": {{ $("Normalizar Dados").item.json.amount }},\n    "currency_id": "BRL"\n  }],\n  "payer": { "name": "{{ $("Normalizar Dados").item.json.contact_name }}" },\n  "back_urls": { "success": "https://wacrm.autofunil.com.br/", "failure": "https://wacrm.autofunil.com.br/", "pending": "https://wacrm.autofunil.com.br/" },\n  "auto_return": "approved",\n  "external_reference": "{{ $("Normalizar Dados").item.json.conversation_id }}"\n}'),
      options: { timeout: 15000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("Mercado Pago") },
    executeOnce: true,
    position: [1740, 50],
  },
  output: [{ id: "", init_point: "" }],
});

const sendLink = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Enviar Link",
    parameters: {
      method: "POST",
      url: placeholder("https://wacrm.autofunil.com.br/api/v1/messages"),
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr('{\n  "to": "{{ $("Normalizar Dados").item.json.contact_phone }}",\n  "text": "Segue o link de pagamento para {{ $("Normalizar Dados").item.json.description }} (R$ {{ $("Normalizar Dados").item.json.amount }}):\n{{ $("Criar Cobranca (MP)").item.json.init_point }}"\n}'),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2040, 50],
  },
  output: [{ data: {} }],
});

// ============================================================
// BRANCH B: check_payment
// ============================================================

const checkStatus = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Consultar Status (MP)",
    parameters: {
      method: "GET",
      url: expr('https://api.mercadopago.com/v1/payments/search?external_reference={{ $("Normalizar Dados").item.json.conversation_id }}&sort=date_created&criteria=desc'),
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("Mercado Pago") },
    executeOnce: true,
    position: [1740, 200],
  },
  output: [{ results: [{ id: 0, status: "pending", date_approved: null }], paging: { total: 0 } }],
});

const hasResults = ifElse({
  version: 2.3,
  config: {
    name: "Tem resultados?",
    parameters: {
      conditions: {
        combinator: "and",
        options: { caseSensitive: false, leftValue: "", typeValidation: "loose" },
        conditions: [
          { leftValue: expr("{{ $json.paging.total }}"), rightValue: "0", operator: { type: "number", operation: "larger" } },
        ],
      },
    },
    position: [2040, 200],
  },
  output: [{}, {}],
});

const isApproved = ifElse({
  version: 2.3,
  config: {
    name: "Aprovado?",
    parameters: {
      conditions: {
        combinator: "or",
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
        conditions: [
          { leftValue: expr("{{ $json.results[0].status }}"), rightValue: "approved", operator: { type: "string", operation: "equals" } },
        ],
      },
    },
    position: [2340, 100],
  },
  output: [{}, {}],
});

const msgApproved = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Notificar Aprovado",
    parameters: {
      method: "POST",
      url: placeholder("https://wacrm.autofunil.com.br/api/v1/messages"),
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr('{\n  "to": "{{ $("Normalizar Dados").item.json.contact_phone }}",\n  "text": "Pagamento confirmado! Obrigado pela compra 🎉"\n}'),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2640, 20],
  },
  output: [{ data: {} }],
});

const msgPending = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Notificar Pendente",
    parameters: {
      method: "POST",
      url: placeholder("https://wacrm.autofunil.com.br/api/v1/messages"),
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr('{\n  "to": "{{ $("Normalizar Dados").item.json.contact_phone }}",\n  "text": "Seu pagamento esta {{ $json.results[0].status_detail }}. Assim que for confirmado, avisamos voce!"\n}'),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2640, 160],
  },
  output: [{ data: {} }],
});

const msgNotFound = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Notificar Nao Encontrado",
    parameters: {
      method: "POST",
      url: placeholder("https://wacrm.autofunil.com.br/api/v1/messages"),
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr('{\n  "to": "{{ $("Normalizar Dados").item.json.contact_phone }}",\n  "text": "Nenhum pagamento encontrado para esta conversa. O link de pagamento foi enviado? Pode pedir um novo quando quiser!"\n}'),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2340, 280],
  },
  output: [{ data: {} }],
});

// ============================================================
// BRANCH C: send_media
// ============================================================

const sendMedia = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Enviar Midia",
    parameters: {
      method: "POST",
      url: placeholder("https://wacrm.autofunil.com.br/api/v1/messages"),
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      sendBody: true,
      contentType: "json",
      specifyBody: "json",
      jsonBody: expr('{\n  "to": "{{ $("Normalizar Dados").item.json.contact_phone }}",\n  "type": "{{ $("Normalizar Dados").item.json.media_type }}",\n  "media_url": "{{ $("Normalizar Dados").item.json.media_url }}",\n  "text": ""\n}'),
      options: { timeout: 15000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1740, 350],
  },
  output: [{ data: {} }],
});

// ============================================================
// COMPOSE
// ============================================================

export default workflow("wacrm-payment-orchestrator", "WACRM - Orquestrador de Pagamentos")
  .add(sticky("## WACRM - Orquestrador (Mercado Pago)\n\nURL automacao wacrm:\n/webhook/wacrm-payment?action=generate_charge&amount=990&description=Botox\n/webhook/wacrm-payment?action=check_payment\n/webhook/wacrm-payment?action=send_media&media_url=...&media_type=image\nbody_template: vazio"))
  .add(webhook)
  .to(fetchConversation)
  .to(fetchContact)
  .to(normalize)
  .to(router
    .onCase(0, chargeApi.to(sendLink))
    .onCase(1, checkStatus.to(hasResults
      .onTrue(isApproved
        .onTrue(msgApproved)
        .onFalse(msgPending),
      )
      .onFalse(msgNotFound),
    ))
    .onCase(2, sendMedia),
  );
