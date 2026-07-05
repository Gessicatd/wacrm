import {
  workflow,
  node,
  trigger,
  ifElse,
  splitInBatches,
  nextBatch,
  sticky,
  expr,
  placeholder,
  newCredential,
} from "@n8n/workflow-sdk";

const schedule = trigger({
  type: "n8n-nodes-base.scheduleTrigger",
  version: 1.3,
  config: {
    name: "Schedule (5 min)",
    parameters: {
      rule: { interval: [{ field: "minutes", minutesInterval: 5 }] },
    },
    position: [240, 300],
  },
  output: [{}],
});

const searchApproved = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Buscar Aprovados",
    parameters: {
      method: "GET",
      url: "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=50&status=approved",
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      options: { timeout: 15000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("Mercado Pago") },
    alwaysOutputData: true,
    position: [540, 300],
  },
  output: [{ results: [{ id: 0, status: "approved", external_reference: "" }], paging: { total: 0 } }],
});

const hasResults = ifElse({
  version: 2.3,
  config: {
    name: "Tem aprovados?",
    parameters: {
      conditions: {
        combinator: "and",
        options: { caseSensitive: false, leftValue: "", typeValidation: "loose" },
        conditions: [
          { leftValue: expr("{{ $json.paging.total }}"), rightValue: "0", operator: { type: "number", operation: "larger" } },
        ],
      },
    },
    position: [840, 300],
  },
  output: [{}, {}],
});

const sibNode = splitInBatches({
  version: 3,
  config: {
    name: "Processar Lote",
    parameters: { batchSize: 10 },
    position: [1140, 300],
  },
});

const checkNotified = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Ja notificado?",
    parameters: {
      resource: "row",
      operation: "rowNotExists",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "payment_id", condition: "eq", keyValue: expr("{{ $json.id }}") },
          { keyName: "notified_confirmed", condition: "eq", keyValue: "true" },
        ],
      },
    },
    position: [1440, 100],
  },
  output: [{ id: 0 }],
});

const fetchConversation = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Buscar Conversa (API)",
    parameters: {
      method: "GET",
      url: expr('https://wacrm.autofunil.com.br/api/v1/conversations/{{ $("Buscar Aprovados").item.json.external_reference }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1740, 200],
  },
  output: [{ data: { id: "", contact_id: "" } }],
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
    position: [2040, 200],
  },
  output: [{ data: { id: "", name: "", phone: "" } }],
});

const notifyClient = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Notificar Cliente",
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
      jsonBody: expr('{\n  "to": "{{ $("Buscar Contato (API)").item.json.data.phone }}",\n  "text": "Pagamento confirmado! Obrigado pela compra 🎉"\n}'),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2340, 200],
  },
  output: [{ data: {} }],
});

const markNotified = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Marcar como notificado",
    parameters: {
      resource: "row",
      operation: "upsert",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "payment_id", condition: "eq", keyValue: expr("{{ $json.id }}") },
        ],
      },
      columns: expr('{ "mappingMode": "defineBelow", "value": [{ "column": "payment_id", "value": "{{ $json.id }}" }, { "column": "notified_confirmed", "value": "true" }, { "column": "status", "value": "confirmed" }] }'),
    },
    executeOnce: true,
    position: [2640, 200],
  },
  output: [{ id: 0 }],
});

const fim = node({ type: "n8n-nodes-base.noOp", version: 1, config: { name: "Fim" }, position: [1440, 400] });

export default workflow("wacrm-payment-checker", "WACRM - Verificador de Pagamentos")
  .add(sticky("## Verificador (c/ dedup)\n\nSo notifica 1x. Usa tabela wacrm_pagamentos.notified_confirmed."))
  .add(schedule)
  .to(searchApproved)
  .to(hasResults
    .onTrue(sibNode
      .onDone(fim)
      .onEachBatch(checkNotified.to(fetchConversation).to(fetchContact).to(notifyClient).to(markNotified).to(nextBatch(sibNode))),
    )
    .onFalse(fim),
  );
