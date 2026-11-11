// Reads the settings from backend/.env and checks them.
// If something is missing or wrong, the server stops with a clear message
// (it names the setting, never prints its value).
import dotenv from 'dotenv';
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

    // Africa's Talking (SMS). Only used when NODE_ENV=production.
    AT_USERNAME: z.string().min(1, 'AT_USERNAME cannot be empty').default('sandbox'),
    AT_API_KEY: z.string().optional(),

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
    if (env.NODE_ENV === 'production' && (!env.AT_API_KEY || env.AT_API_KEY.startsWith('your_'))) {
      ctx.addIssue({
        code: 'custom',
        path: ['AT_API_KEY'],
        message: 'AT_API_KEY is required in production',
      });
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
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  africasTalking: {
    username: env.AT_USERNAME,
    apiKey: env.AT_API_KEY,
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
