import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  CLIENT_ORIGIN: z.string().url(),
  CLIENT_ORIGIN_PREVIEW_PATTERN: z
    .string()
    .optional()
    .transform((p) => (p && p.length > 0 ? p : undefined))
    .refine((p) => {
      if (!p) return true;
      try {
        new RegExp(p);
        return true;
      } catch {
        return false;
      }
    }, "CLIENT_ORIGIN_PREVIEW_PATTERN must be a valid regex"),
  COOKIE_DOMAIN: z.string().default("localhost"),
  ADMIN_AUTH_COOKIE_NAME: z.string().min(1).default("quarzo_admin_session"),
  CUSTOMER_AUTH_COOKIE_NAME: z
    .string()
    .min(1)
    .default("quarzo_customer_session"),
  AUTH_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(12),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),
  R2_KEY_PREFIX: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v.replace(/^\/+|\/+$/g, "") : "")),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
