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

// ============================================================
// WACRM - VERIFICADOR DE PAGAMENTOS
//
// Agenda: a cada 5 minutos
// Lê pagamentos pendentes da tabela, consulta status na
// gateway, e notifica o cliente se foi confirmado.
// ============================================================

const schedule = trigger({
  type: "n8n-nodes-base.scheduleTrigger",
  version: 1.3,
  config: {
    name: "Schedule (5 min)",
    parameters: {
      rule: {
        interval: [
          { field: "minutes", minutesInterval: 5 },
        ],
      },
    },
    position: [240, 300],
  },
  output: [{}],
});

const fetchPending = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar Pendentes",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "status", condition: "eq", keyValue: "pending" },
        ],
      },
      returnAll: true,
      orderBy: true,
      orderByColumn: "createdAt",
      orderByDirection: "ASC",
    },
    alwaysOutputData: true,
    position: [540, 300],
  },
  output: [{ id: 1, payment_id: "", contact_phone: "", contact_name: "", amount: 0, status: "pending", reminder_count: 0 }],
});

const updateCheckedAt = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Atualizar Ultima Verificacao",
    parameters: {
      resource: "row",
      operation: "update",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "id", condition: "eq", keyValue: expr("{{ $json.id }}") },
        ],
      },
      columns: expr(
        '{\n' +
        '  "mappingMode": "defineBelow",\n' +
        '  "value": [\n' +
        '    { "column": "last_checked_at", "value": "{{ $now.toISO() }}" }\n' +
        '  ]\n' +
        '}',
      ),
    },
    position: [840, 300],
  },
  output: [{ id: 1 }],
});

// --------------------------------------------------
// BATCH PROCESSING: process each pending payment
// --------------------------------------------------

const sibNode = splitInBatches({
  version: 3,
  config: {
    name: "Processar em Lotes",
    parameters: { batchSize: 5 },
    position: [1140, 300],
  },
});

const checkStatus = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Verificar Status na Gateway",
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
    position: [1440, 200],
  },
  output: [{ id: "", status: "", paidDate: "" }],
});

// --------------------------------------------------
// IF: payment confirmed?
// --------------------------------------------------

const checkConfirmed = ifElse({
  version: 2.3,
  config: {
    name: "Foi Confirmado?",
    parameters: {
      conditions: {
        combinator: "or",
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
        conditions: [
          { leftValue: expr("{{ $json.status }}"), rightValue: "CONFIRMED", operator: { type: "string", operation: "equals" } },
          { leftValue: expr("{{ $json.status }}"), rightValue: "RECEIVED", operator: { type: "string", operation: "equals" } },
          { leftValue: expr("{{ $json.status }}"), rightValue: "confirmed", operator: { type: "string", operation: "equals" } },
          { leftValue: expr("{{ $json.status }}"), rightValue: "received", operator: { type: "string", operation: "equals" } },
          { leftValue: expr("{{ $json.status }}"), rightValue: "paid", operator: { type: "string", operation: "equals" } },
        ],
      },
    },
    position: [1740, 200],
  },
  output: [{}, {}],
});

const notifyClient = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Notificar Cliente",
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
        '  "to": "{{ $json.contact_phone }}",\n' +
        '  "text": "Pagamento confirmado! Obrigado pela compra 🎉"\n' +
        '}',
      ),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpHeaderAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2040, 100],
  },
  output: [{ data: {} }],
});

const markConfirmed = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Marcar como Pago",
    parameters: {
      resource: "row",
      operation: "update",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "id", condition: "eq", keyValue: expr("{{ $json.id }}") },
        ],
      },
      columns: expr(
        '{\n' +
        '  "mappingMode": "defineBelow",\n' +
        '  "value": [\n' +
        '    { "column": "status", "value": "confirmed" },\n' +
        '    { "column": "last_checked_at", "value": "{{ $now.toISO() }}" }\n' +
        '  ]\n' +
        '}',
      ),
    },
    position: [2040, 200],
  },
  output: [{ id: 1 }],
});

export default workflow("wacrm-payment-checker", "WACRM - Verificador de Pagamentos")
  .add(sticky("## WACRM - Verificador de Pagamentos\n\nExecuta a cada 5 minutos.\n\n1. Busca pagamentos com status `pending` na tabela `wacrm_pagamentos`\n2. Para cada um, consulta o status real na gateway\n3. Se foi confirmado: notifica o cliente via WhatsApp e marca como `confirmed` na tabela\n4. Se ainda pendente: apenas atualiza `last_checked_at`"))
  .add(schedule)
  .to(fetchPending)
  .to(updateCheckedAt)
  .to(sibNode
    .onDone(node({ type: "n8n-nodes-base.noOp", version: 1, config: { name: "Fim" }, position: [1440, 400] }))
    .onEachBatch(checkStatus.to(checkConfirmed
      .onTrue(notifyClient.to(markConfirmed))
      .onFalse(nextBatch(sibNode)),
    )),
  );
