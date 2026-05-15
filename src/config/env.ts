import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  APP_BASE_URL: z.string().optional(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGINS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z
    .string()
    .regex(
      /^(?:[^<>]+\s<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/,
      'EMAIL_FROM must be in the format email@example.com or Name <email@example.com>'
    )
    .default('House Rental <onboarding@resend.dev>'),
  SUPPORT_EMAIL: z.string().email().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  GOOGLE_EMAIL_USER: z.string().email().optional(),
  GOOGLE_EMAIL_PASS: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const rawEnv = envSchema.parse(process.env);

function deriveBaseUrl(appBaseUrl: string | undefined, nodeEnv: string, port: string): string {
  const fallback = `${nodeEnv === 'production' ? 'https' : 'http'}://localhost:${port}`;

  if (!appBaseUrl) return fallback;

  try {
    const normalizedInput = /^https?:\/\//i.test(appBaseUrl) ? appBaseUrl : `http://${appBaseUrl}`;
    const parsed = new URL(normalizedInput);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('APP_BASE_URL must use http or https protocol.');
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    console.warn(`Invalid APP_BASE_URL value "${appBaseUrl}". Falling back to ${fallback}.`);
    return fallback;
  }
}

const localOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const configuredOrigins = rawEnv.ALLOWED_ORIGINS
  ? rawEnv.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];

export const env = {
  ...rawEnv,
  APP_BASE_URL: deriveBaseUrl(rawEnv.APP_BASE_URL, rawEnv.NODE_ENV, rawEnv.PORT),
  ALLOWED_ORIGINS: Array.from(
    new Set(
      [
        rawEnv.FRONTEND_URL,
        ...(rawEnv.NODE_ENV === 'production' ? [] : localOrigins),
        ...configuredOrigins,
      ].filter(Boolean) as string[]
    )
  ),
};
