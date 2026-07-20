import { workflow, node, trigger, newCredential, switchCase, expr } from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Sync Every 2 Minutes',
    parameters: {
      rule: {
        interval: [{ field: 'minutes', minutesInterval: 2 }]
      }
    },
    position: [240, 300]
  },
  output: [{}]
});

const fetchPendingEvents = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Fetch Pending Sync Events',
    parameters: {
      method: 'GET',
      url: placeholder('wacrm API URL: https://yourdomain.com/api/v1/calendar/events?sync_status=pending_create,pending_update,pending_delete'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: expr('Bearer {{ $credentials.headerAuth.value }}') }
        ]
      },
      options: {
        response: {
          response: {
            responseFormat: 'json'
          }
        }
      }
    },
    credentials: { httpHeaderAuth: newCredential('wacrm API Key') },
    position: [540, 300]
  },
  output: [
    { id: 'evt-1', title: 'Meeting', sync_status: 'pending_create', start_at: '2026-01-01T10:00:00Z', end_at: '2026-01-01T11:00:00Z' },
    { id: 'evt-2', title: 'Call', sync_status: 'pending_update', google_event_id: 'google-123', start_at: '2026-01-02T14:00:00Z', end_at: '2026-01-02T15:00:00Z' }
  ]
});

const routeBySyncStatus = switchCase({
  version: 3.4,
  config: {
    name: 'Route by Sync Status',
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          {
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [
                { leftValue: expr('={{ $json.sync_status }}'), rightValue: 'pending_create', operator: { type: 'string', operation: 'equals' } }
              ],
              combinator: 'and'
            },
            renameOutput: true,
            outputKey: 'create'
          },
          {
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [
                { leftValue: expr('={{ $json.sync_status }}'), rightValue: 'pending_update', operator: { type: 'string', operation: 'equals' } }
              ],
              combinator: 'and'
            },
            renameOutput: true,
            outputKey: 'update'
          },
          {
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
              conditions: [
                { leftValue: expr('={{ $json.sync_status }}'), rightValue: 'pending_delete', operator: { type: 'string', operation: 'equals' } }
              ],
              combinator: 'and'
            },
            renameOutput: true,
            outputKey: 'delete'
          }
        ]
      },
      options: {
        fallbackOutput: 'none'
      }
    },
    position: [840, 300]
  }
});

const createGoogleEvent = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Create in Google Calendar',
    parameters: {
      resource: 'event',
      operation: 'create',
      calendar: { __rl: true, mode: 'list', value: '' },
      start: expr('{{ $json.start_at }}'),
      end: expr('{{ $json.end_at }}'),
      additionalFields: {
        summary: expr('{{ $json.title }}'),
        description: expr('{{ $json.description }}'),
        location: expr('{{ $json.location }}')
      }
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') },
    position: [1140, 200]
  },
  output: [{ id: 'google-ev-999', summary: 'Meeting', htmlLink: 'https://calendar.google.com/...' }]
});

const updateGoogleEvent = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Update in Google Calendar',
    parameters: {
      resource: 'event',
      operation: 'update',
      calendar: { __rl: true, mode: 'list', value: '' },
      eventId: expr('{{ $json.google_event_id }}'),
      updateFields: {
        summary: expr('{{ $json.title }}'),
        description: expr('{{ $json.description }}'),
        location: expr('{{ $json.location }}'),
        start: expr('{{ $json.start_at }}'),
        end: expr('{{ $json.end_at }}')
      }
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') },
    position: [1140, 400]
  },
  output: [{ id: 'google-ev-123', summary: 'Call', htmlLink: 'https://calendar.google.com/...' }]
});

const deleteGoogleEvent = node({
  type: 'n8n-nodes-base.googleCalendar',
  version: 1.3,
  config: {
    name: 'Delete from Google Calendar',
    parameters: {
      resource: 'event',
      operation: 'delete',
      calendar: { __rl: true, mode: 'list', value: '' },
      eventId: expr('{{ $json.google_event_id }}')
    },
    credentials: { googleCalendarOAuth2Api: newCredential('Google Calendar OAuth2') },
    position: [1140, 600]
  },
  output: [{ success: true }]
});

const markCreatedSynced = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Mark Created as Synced',
    parameters: {
      method: 'PATCH',
      url: expr('{{ $("Fetch Pending Sync Events").first().json._wacrm_base_url + "/api/v1/calendar/events/" + $json._local_event_id }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('JSON.stringify({ google_event_id: $json.id, sync_status: "synced", last_synced_at: new Date().toISOString() })')
    },
    credentials: { httpHeaderAuth: newCredential('wacrm API Key') },
    position: [1440, 200]
  },
  output: [{ id: 'evt-1', sync_status: 'synced' }]
});

const markUpdatedSynced = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Mark Updated as Synced',
    parameters: {
      method: 'PATCH',
      url: expr('{{ $("Fetch Pending Sync Events").first().json._wacrm_base_url + "/api/v1/calendar/events/" + $json._local_event_id }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('JSON.stringify({ sync_status: "synced", last_synced_at: new Date().toISOString() })')
    },
    credentials: { httpHeaderAuth: newCredential('wacrm API Key') },
    position: [1440, 400]
  },
  output: [{ id: 'evt-2', sync_status: 'synced' }]
});

const markDeletedSynced = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Delete Local Event',
    parameters: {
      method: 'DELETE',
      url: expr('{{ $("Fetch Pending Sync Events").first().json._wacrm_base_url + "/api/v1/calendar/events/" + $json._local_event_id }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth'
    },
    credentials: { httpHeaderAuth: newCredential('wacrm API Key') },
    position: [1440, 600]
  },
  output: [{ deleted: true }]
});

export default workflow('wacrm-calendar-sync', 'WACRM Calendar Sync')
  .add(scheduleTrigger)
  .to(fetchPendingEvents)
  .to(routeBySyncStatus
    .onCase(0, createGoogleEvent.to(markCreatedSynced))
    .onCase(1, updateGoogleEvent.to(markUpdatedSynced))
    .onCase(2, deleteGoogleEvent.to(markDeletedSynced))
  );
