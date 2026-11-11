import { readFileSync } from 'node:fs';

export const PAYMENT_DATABASE_PROJECT = 'pzqlzomrvondxikyafvy';

// Dedicated migration configuration. Never fall back to another app's database.
export function paymentDatabaseConfig(raw) {
  if (typeof raw !== 'string' || !raw) throw new Error('Payment database URL required');
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid payment database URL'); }
  let user, password;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch { throw new Error('Invalid database credential encoding'); }
  const session = url.hostname === 'aws-0-ap-southeast-1.pooler.supabase.com'
    && user === `postgres.${PAYMENT_DATABASE_PROJECT}`;
  const direct = url.hostname === `db.${PAYMENT_DATABASE_PROJECT}.supabase.co` && user === 'postgres';
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (!session && !direct)
      || (url.port && url.port !== '5432') || url.pathname !== '/postgres'
      || url.search || url.hash) throw new Error('Unexpected payment database target or URL options');
  if (!password || password === '[YOUR-PASSWORD]') throw new Error('Database password required');
  return {
    host: url.hostname, port: 5432, user, password, database: 'postgres',
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync(new URL('../../certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8'),
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    application_name: 'manytool-payment-migration',
  };
}

export function assertPaymentTls(client) {
  // pg_stat_ssl describes pooler -> Postgres, not this client's TLS connection.
  const stream = client.connection?.stream;
  if (stream?.encrypted !== true || stream.authorized !== true) {
    throw new Error('Verified database TLS required');
  }
}
