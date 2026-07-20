import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export async function exchangeCode(code: string): Promise<TokenSet> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      'Google returned tokens without access_token or refresh_token'
    );
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expiry_date: number }> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('Failed to refresh Google access token');
  }

  return {
    access_token: credentials.access_token,
    expiry_date: credentials.expiry_date ?? Date.now() + 3600 * 1000,
  };
}

export async function revokeToken(token: string): Promise<void> {
  const oauth2Client = createOAuth2Client();
  await oauth2Client.revokeToken(token);
}

export async function getUserEmail(
  accessToken: string
): Promise<string> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data.email ?? 'unknown';
}

export function getCalendarClient(
  accessToken: string
): calendar_v3.Calendar {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function listCalendars(
  accessToken: string
): Promise<calendar_v3.Schema$CalendarListEntry[]> {
  const calendar = getCalendarClient(accessToken);
  const { data } = await calendar.calendarList.list();
  return data.items ?? [];
}

export async function getValidAccessToken(
  refreshToken: string,
  currentToken: string,
  expiresAt: number
): Promise<string> {
  const bufferMs = 5 * 60 * 1000;
  const now = Date.now();

  if (expiresAt > now + bufferMs) {
    return currentToken;
  }

  const { access_token } = await refreshAccessToken(refreshToken);
  return access_token;
}
