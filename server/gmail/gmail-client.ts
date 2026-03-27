import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

function getOAuth2(): OAuth2Client {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN must be set for Gmail',
    );
  }
  const o = new OAuth2Client(id, secret);
  o.setCredentials({ refresh_token: refresh });
  return o;
}

export function getGmailApi() {
  return google.gmail({ version: 'v1', auth: getOAuth2() });
}
