import {
  workflow,
  node,
  trigger,
  ifElse,
  switchCase,
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
    name: "Schedule (1 hora)",
    parameters: {
      rule: { interval: [{ field: "hours", hoursInterval: 1, triggerAtMinute: 0 }] },
    },
    position: [240, 300],
  },
  output: [{}],
});

const searchPending = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Buscar Pendentes",
    parameters: {
      method: "GET",
      url: "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=100",
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
  output: [{ results: [{ id: 0, status: "pending", date_created: "", external_reference: "" }] }],
});

const checkPending = ifElse({
  version: 2.3,
  config: {
    name: "Pendente?",
    parameters: {
      conditions: {
        combinator: "or",
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
        conditions: [
          { leftValue: expr("{{ $json.status }}"), rightValue: "pending", operator: { type: "string", operation: "equals" } },
          { leftValue: expr("{{ $json.status }}"), rightValue: "in_process", operator: { type: "string", operation: "equals" } },
        ],
      },
    },
    position: [840, 200],
  },
  output: [{}, {}],
});

const calcAge = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Calcular Idade",
    parameters: {
      mode: "manual",
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: "a", name: "horas_criacao", value: expr("{{ $now.diff($json.date_created, 'hours').hours }}"), type: "number" },
          { id: "b", name: "external_ref", value: expr("{{ $json.external_reference }}"), type: "string" },
          { id: "c", name: "mp_payment_id", value: expr("{{ $json.id }}"), type: "string" },
        ],
      },
    },
    position: [1140, 300],
  },
  output: [{ horas_criacao: 0, external_ref: "", mp_payment_id: "" }],
});

const stage = switchCase({
  version: 3.4,
  config: {
    name: "Estagio",
    parameters: {
      mode: "rules",
      rules: {
        values: [
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
              conditions: [{ leftValue: expr("{{ $json.horas_criacao }}"), rightValue: "24", operator: { type: "number", operation: "lesser" } }],
            },
            renameOutput: true, outputKey: "4-24h",
          },
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
              conditions: [{ leftValue: expr("{{ $json.horas_criacao }}"), rightValue: "48", operator: { type: "number", operation: "lesser" } }],
            },
            renameOutput: true, outputKey: "24-48h",
          },
          {
            conditions: {
              combinator: "and",
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
              conditions: [{ leftValue: expr("{{ $json.horas_criacao }}"), rightValue: "48", operator: { type: "number", operation: "largerEqual" } }],
            },
            renameOutput: true, outputKey: "48h+",
          },
        ],
      },
      options: { fallbackOutput: "extra" },
    },
    position: [1440, 200],
  },
  output: [{}, {}, {}, {}],
});

// ── Branch: 4-24h ──

const checkReminder4h = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Ja lembrou 4h?",
    parameters: {
      resource: "row",
      operation: "rowNotExists",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "payment_id", condition: "eq", keyValue: expr("{{ $json.mp_payment_id }}") },
          { keyName: "reminder_sent_4h", condition: "eq", keyValue: true },
        ],
      },
    },
    position: [1740, 20],
  },
  output: [{ id: 0 }],
});

const msg4h = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Lembrete 4h",
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
      jsonBody: expr('{\n  "to": "{{ $json.external_ref }}",\n  "text": "Ola! Vi que voce iniciou uma compra. O link de pagamento continua disponivel. 😊"\n}'),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2040, 20],
  },
  output: [{ data: {} }],
});

const mark4h = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Marcar 4h",
    parameters: {
      resource: "row",
      operation: "upsert",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "payment_id", condition: "eq", keyValue: expr("{{ $json.mp_payment_id }}") },
        ],
      },
      columns: expr('{\n  "mappingMode": "defineBelow",\n  "value": [\n    { "column": "payment_id", "value": "{{ $json.mp_payment_id }}" },\n    { "column": "reminder_sent_4h", "value": true }\n  ]\n}'),
    },
    executeOnce: true,
    position: [2340, 20],
  },
  output: [{ id: 0 }],
});

// ── Branch: 24-48h ──

const checkReminder24h = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Ja lembrou 24h?",
    parameters: {
      resource: "row",
      operation: "rowNotExists",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "payment_id", condition: "eq", keyValue: expr("{{ $json.mp_payment_id }}") },
          { keyName: "reminder_sent_24h", condition: "eq", keyValue: true },
        ],
      },
    },
    position: [1740, 150],
  },
  output: [{ id: 0 }],
});

const msg24h = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Lembrete 24h",
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
      jsonBody: expr('{\n  "to": "{{ $json.external_ref }}",\n  "text": "Ainda estamos aguardando seu pagamento. O link continua disponivel para voce finalizar."\n}'),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2040, 150],
  },
  output: [{ data: {} }],
});

const mark24h = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Marcar 24h",
    parameters: {
      resource: "row",
      operation: "upsert",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "payment_id", condition: "eq", keyValue: expr("{{ $json.mp_payment_id }}") },
        ],
      },
      columns: expr('{\n  "mappingMode": "defineBelow",\n  "value": [\n    { "column": "payment_id", "value": "{{ $json.mp_payment_id }}" },\n    { "column": "reminder_sent_24h", "value": true }\n  ]\n}'),
    },
    executeOnce: true,
    position: [2340, 150],
  },
  output: [{ id: 0 }],
});

// ── Branch: 48h+ ──

const checkReminder48h = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Ja lembrou 48h?",
    parameters: {
      resource: "row",
      operation: "rowNotExists",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "payment_id", condition: "eq", keyValue: expr("{{ $json.mp_payment_id }}") },
          { keyName: "reminder_sent_48h", condition: "eq", keyValue: true },
        ],
      },
    },
    position: [1740, 280],
  },
  output: [{ id: 0 }],
});

const msg48h = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Lembrete 48h",
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
      jsonBody: expr('{\n  "to": "{{ $json.external_ref }}",\n  "text": "Aviso: seu link de pagamento expirara em breve. Acesse agora para garantir sua compra!"\n}'),
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [2040, 280],
  },
  output: [{ data: {} }],
});

const mark48h = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Marcar 48h",
    parameters: {
      resource: "row",
      operation: "upsert",
      dataTableId: { mode: "id", value: "2DKcXyjaEhczwgsA" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "payment_id", condition: "eq", keyValue: expr("{{ $json.mp_payment_id }}") },
        ],
      },
      columns: expr('{\n  "mappingMode": "defineBelow",\n  "value": [\n    { "column": "payment_id", "value": "{{ $json.mp_payment_id }}" },\n    { "column": "reminder_sent_48h", "value": true }\n  ]\n}'),
    },
    executeOnce: true,
    position: [2340, 280],
  },
  output: [{ id: 0 }],
});

const fim = node({ type: "n8n-nodes-base.noOp", version: 1, config: { name: "Aguardar" }, position: [1440, 400] });

export default workflow("wacrm-followup", "WACRM - Follow-up de Vendas")
  .add(sticky("## WACRM - Follow-up (c/ dedup)\n\nEnvia lembretes apenas UMA vez para cada estagio (4h, 24h, 48h).\nUsa a tabela wacrm_pagamentos para rastrear."))
  .add(schedule)
  .to(searchPending)
  .to(checkPending
    .onTrue(calcAge.to(stage
      .onCase(0, checkReminder4h.onTrue(msg4h.to(mark4h)).onFalse(fim))
      .onCase(1, checkReminder24h.onTrue(msg24h.to(mark24h)).onFalse(fim))
      .onCase(2, checkReminder48h.onTrue(msg48h.to(mark48h)).onFalse(fim)),
    ))
    .onFalse(fim),
  );
