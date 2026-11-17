// Reads the settings from backend/.env and checks them.
// If something is missing or wrong, the server stops with a clear message
// (it names the setting, never prints its value).
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Always load backend/.env, no matter which folder the command is run from.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env'), quiet: true });

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),

    DB_HOST: z.string().min(1, 'DB_HOST is required'),
    DB_PORT: z.coerce.number().int().min(1).max(65535),
    DB_NAME: z.string().min(1, 'DB_NAME is required'),
    DB_USER: z.string().min(1, 'DB_USER is required'),
    DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),

    // Login tokens. Must be long, random and secret.
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters (see .env.example)')
      .refine(
        (v) => !v.startsWith('change_me'),
        'JWT_SECRET is still the example text. Replace it with your own long random text (see .env.example)'
      ),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN must look like 7d, 12h or 30m')
      .default('7d'),

    // Key that locks private seller details (national ID, KRA PIN) in the database. 64 hex characters.
    // Make one with:  node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
    // Keep a safe copy: without it those details can never be read again.
    DATA_ENCRYPTION_KEY: z
      .string('DATA_ENCRYPTION_KEY is required (see .env.example)')
      .regex(/^[0-9a-fA-F]{64}$/, 'DATA_ENCRYPTION_KEY must be exactly 64 hex characters (see .env.example)'),

    // Payments. "simulated" = no real money moves (development). "daraja" = real M-Pesa (sandbox or live).
    PAYMENTS_MODE: z.enum(['simulated', 'daraja']).default('simulated'),
    DARAJA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
    DARAJA_CONSUMER_KEY: z.string().optional(),
    DARAJA_CONSUMER_SECRET: z.string().optional(),
    DARAJA_SHORTCODE: z.string().optional(), // sandbox: 174379
    DARAJA_PASSKEY: z.string().optional(),
    // CustomerPayBillOnline for a Paybill, CustomerBuyGoodsOnline for a Till.
    DARAJA_TRANSACTION_TYPE: z.enum(['CustomerPayBillOnline', 'CustomerBuyGoodsOnline']).default('CustomerPayBillOnline'),
    DARAJA_PARTY_B: z.string().optional(), // the Till number for Buy Goods. Leave empty to use the shortcode.
    // The public https address Safaricom calls with payment results (for example your ngrok address).
    DARAJA_CALLBACK_BASE_URL: z.string().optional(),
    // A long random secret that is part of the callback address, so only Safaricom (who is told the address) can call it.
    DARAJA_CALLBACK_SECRET: z.string().optional(),

    // Paying sellers and refunding buyers. off = payouts are recorded and wait for staff (no money is sent).
    PAYOUTS_MODE: z.enum(['off', 'daraja']).default('off'),
    DARAJA_INITIATOR_NAME: z.string().optional(),
    DARAJA_INITIATOR_PASSWORD: z.string().optional(),
    // The Safaricom certificate file used to lock the initiator password (sandbox: from the Daraja portal). A path on this computer.
    DARAJA_CERT_PATH: z.string().optional(),
    // Easier option: paste the Security Credential that the Daraja portal generates from the initiator password.
    // When it is set, the password and the certificate file are not needed.
    DARAJA_SECURITY_CREDENTIAL: z.string().optional(),
    // The shortcode money is paid OUT from. In the sandbox B2C this is the test shortcode shown on the portal. Empty = the STK shortcode.
    DARAJA_PAYOUT_SHORTCODE: z.string().optional(),

    // Email codes (sign-in, sign-up, password and payout changes). console = printed in this terminal. smtp = a real email is sent with a Gmail account.
    EMAIL_MODE: z.enum(['console', 'smtp']).default('console'),
    EMAIL_USER: z.string().optional(), // the Gmail address that sends the emails
    EMAIL_APP_PASSWORD: z.string().optional(), // a Google "App password" (not the normal Gmail password)
    EMAIL_FROM_NAME: z.string().min(1).default('VibeYetu'),

    // Cloudinary (photos). Optional: without them the server still runs, but photo uploads say "not set up".
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    // Help assistant (Google Gemini, free key from https://aistudio.google.com). Optional:
    // without a key the assistant still answers, using the built-in answers.
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().min(1).default('gemini-flash-latest'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      const bad = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean).filter((o) => !/^https:\/\//.test(o) || /localhost|127\.0\.0\.1/.test(o) || o === '*');
      if (bad.length) ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: `CORS_ORIGIN must list only your real https website address in production (not: ${bad.join(', ')})` });
    }
    if (env.NODE_ENV === 'production' && env.PAYMENTS_MODE !== 'daraja') {
      ctx.addIssue({ code: 'custom', path: ['PAYMENTS_MODE'], message: 'PAYMENTS_MODE must be daraja in production (simulated payments move no real money)' });
    }
    if (env.NODE_ENV === 'production' && env.PAYOUTS_MODE !== 'daraja') {
      ctx.addIssue({ code: 'custom', path: ['PAYOUTS_MODE'], message: 'PAYOUTS_MODE must be daraja in production (otherwise sellers are never paid)' });
    }
    if (env.PAYOUTS_MODE === 'daraja') {
      const need = (key, ok, message) => {
        if (!ok) ctx.addIssue({ code: 'custom', path: [key], message });
      };
      need('PAYMENTS_MODE', env.PAYMENTS_MODE === 'daraja', 'PAYMENTS_MODE must be daraja when PAYOUTS_MODE=daraja');
      need('DARAJA_INITIATOR_NAME', Boolean(env.DARAJA_INITIATOR_NAME), 'DARAJA_INITIATOR_NAME is required when PAYOUTS_MODE=daraja');
      const lockedByCert = Boolean(env.DARAJA_INITIATOR_PASSWORD) && Boolean(env.DARAJA_CERT_PATH) && existsSync(env.DARAJA_CERT_PATH);
      need('DARAJA_SECURITY_CREDENTIAL', Boolean(env.DARAJA_SECURITY_CREDENTIAL) || lockedByCert, 'Set DARAJA_SECURITY_CREDENTIAL (generated on the Daraja portal), or set both DARAJA_INITIATOR_PASSWORD and a DARAJA_CERT_PATH that points to the certificate file');
    }
    if (env.PAYMENTS_MODE === 'daraja') {
      const need = (key, ok, message) => {
        if (!ok) ctx.addIssue({ code: 'custom', path: [key], message });
      };
      const set = (v) => Boolean(v && !v.startsWith('your_'));
      need('DARAJA_CONSUMER_KEY', set(env.DARAJA_CONSUMER_KEY), 'DARAJA_CONSUMER_KEY is required when PAYMENTS_MODE=daraja');
      need('DARAJA_CONSUMER_SECRET', set(env.DARAJA_CONSUMER_SECRET), 'DARAJA_CONSUMER_SECRET is required when PAYMENTS_MODE=daraja');
      need('DARAJA_SHORTCODE', /^\d{5,7}$/.test(env.DARAJA_SHORTCODE || ''), 'DARAJA_SHORTCODE must be 5 to 7 digits (sandbox: 174379)');
      need('DARAJA_PASSKEY', set(env.DARAJA_PASSKEY), 'DARAJA_PASSKEY is required when PAYMENTS_MODE=daraja');
      need('DARAJA_CALLBACK_BASE_URL', /^https:\/\/[^\s/]+/.test(env.DARAJA_CALLBACK_BASE_URL || ''), 'DARAJA_CALLBACK_BASE_URL must be a public https address (for example from ngrok)');
      need('DARAJA_CALLBACK_SECRET', /^[A-Za-z0-9_-]{24,}$/.test(env.DARAJA_CALLBACK_SECRET || ''), 'DARAJA_CALLBACK_SECRET must be at least 24 letters or numbers (see .env.example)');
    }
    if (env.EMAIL_MODE === 'smtp' && (!env.EMAIL_USER || !env.EMAIL_APP_PASSWORD)) {
      ctx.addIssue({ code: 'custom', path: ['EMAIL_USER'], message: 'EMAIL_USER and EMAIL_APP_PASSWORD are required when EMAIL_MODE=smtp' });
    }
    if (env.NODE_ENV === 'production' && env.EMAIL_MODE !== 'smtp') {
      ctx.addIssue({ code: 'custom', path: ['EMAIL_MODE'], message: 'EMAIL_MODE must be smtp in production' });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\nSetup problem: your backend/.env file is missing or has wrong settings:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nFix: copy .env.example to .env and fill in the real values.\n');
  process.exit(1);
}

const env = parsed.data;

// The .env.example placeholders (your_...) count as "not set".
const real = (v) => (v && !v.startsWith('your_') ? v : undefined);
const cloudName = real(env.CLOUDINARY_CLOUD_NAME);
const cloudKey = real(env.CLOUDINARY_API_KEY);
const cloudSecret = real(env.CLOUDINARY_API_SECRET);
const aiKey = real(env.AI_API_KEY);

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  corsOrigins: env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  },
  payouts: {
    mode: env.PAYOUTS_MODE,
    initiatorName: env.DARAJA_INITIATOR_NAME,
    initiatorPassword: env.DARAJA_INITIATOR_PASSWORD,
    certPath: env.DARAJA_CERT_PATH,
    securityCredential: env.DARAJA_SECURITY_CREDENTIAL,
    shortcode: env.DARAJA_PAYOUT_SHORTCODE || env.DARAJA_SHORTCODE,
  },
  payments: {
    mode: env.PAYMENTS_MODE,
    daraja: {
      baseUrl: env.DARAJA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke',
      consumerKey: env.DARAJA_CONSUMER_KEY,
      consumerSecret: env.DARAJA_CONSUMER_SECRET,
      shortcode: env.DARAJA_SHORTCODE,
      passkey: env.DARAJA_PASSKEY,
      transactionType: env.DARAJA_TRANSACTION_TYPE,
      partyB: env.DARAJA_PARTY_B || env.DARAJA_SHORTCODE,
      callbackSecret: env.DARAJA_CALLBACK_SECRET,
      baseCallbackUrl: env.DARAJA_CALLBACK_BASE_URL ? `${env.DARAJA_CALLBACK_BASE_URL.replace(/\/+$/, '')}/hooks/mpesa` : undefined,
      callbackUrl: env.DARAJA_CALLBACK_BASE_URL
        ? `${env.DARAJA_CALLBACK_BASE_URL.replace(/\/+$/, '')}/hooks/mpesa/${env.DARAJA_CALLBACK_SECRET}`
        : undefined,
    },
  },
  dataKey: Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex'),
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  email: {
    mode: env.EMAIL_MODE,
    user: env.EMAIL_USER,
    appPassword: env.EMAIL_APP_PASSWORD ? env.EMAIL_APP_PASSWORD.replace(/\s+/g, '') : undefined,
    fromName: env.EMAIL_FROM_NAME,
  },
  cloudinary: {
    enabled: Boolean(cloudName && cloudKey && cloudSecret),
    cloudName,
    apiKey: cloudKey,
    apiSecret: cloudSecret,
  },
  ai: {
    enabled: Boolean(aiKey),
    apiKey: aiKey,
    model: env.AI_MODEL,
  },
};
