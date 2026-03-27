import { OAuth2Client } from 'google-auth-library';
import { logger } from '@shared/logger';

const client = new OAuth2Client();

export async function verifyPubSubPushJwt(
  authHeader: string | undefined,
  audience: string,
): Promise<void> {
  if (process.env.GMAIL_PUBSUB_SKIP_VERIFY === 'true') {
    logger.warn('GMAIL_PUBSUB_SKIP_VERIFY: skipping Pub/Sub OIDC verification');
    return;
  }
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Bearer Authorization');
  }
  const token = authHeader.slice('Bearer '.length);
  await client.verifyIdToken({ idToken: token, audience });
}
