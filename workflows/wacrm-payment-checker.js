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
// WACRM - VERIFICADOR DE PAGAMENTOS (Mercado Pago)
//
// A cada 5 min, busca pagamentos aprovados no MP,
// descobre o telefone via wacrm API e notifica o cliente.
// ============================================================

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
  output: [{ results: [{ id: 0, status: "approved", external_reference: "", date_approved: "" }], paging: { total: 0 } }],
});

const checkResult = ifElse({
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

const fetchConversation = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.4,
  config: {
    name: "Buscar Conversa (API)",
    parameters: {
      method: "GET",
      url: expr('https://wacrm.autofunil.com.br/api/v1/conversations/{{ $json.external_reference }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
      authentication: "genericCredentialType",
      genericAuthType: "httpBearerAuth",
      options: { timeout: 10000, response: { response: { responseFormat: "json" } } },
    },
    credentials: { httpBearerAuth: newCredential("WACRM API") },
    executeOnce: true,
    position: [1440, 200],
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
    position: [1740, 200],
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
    position: [2040, 200],
  },
  output: [{ data: {} }],
});

const fim = node({ type: "n8n-nodes-base.noOp", version: 1, config: { name: "Aguardar" }, position: [1440, 400] });

export default workflow("wacrm-payment-checker", "WACRM - Verificador de Pagamentos")
  .add(sticky("## WACRM - Verificador (Mercado Pago)\n\nA cada 5 min busca pagamentos com status=approved no MP.\nPara cada um, descobre o contato via wacrm API e notifica."))
  .add(schedule)
  .to(searchApproved)
  .to(checkResult
    .onTrue(sibNode
      .onDone(fim)
      .onEachBatch(
        fetchConversation
          .to(fetchContact)
          .to(notifyClient)
          .to(nextBatch(sibNode)),
      ),
    )
    .onFalse(fim),
  );
