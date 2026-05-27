// In-memory store (express-rate-limit default). With multiple Fly machines
// the effective limit is N × configured value; swap to rate-limit-redis
// when horizontal scaling lands.

import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../config/env.js";

const handler: Options["handler"] = (_req, res) => {
  res.status(429).json({
    error: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
    code: "RATE_LIMITED",
  });
};

// Order placement is unauthenticated and expensive (transaction + up to 51
// row inserts + snapshot computation). 10/min/IP in prod is far above any
// organic customer ceiling; raise via ORDERS_RATE_LIMIT_PER_MINUTE Fly
// secret if real 429s show up in logs. clientToken idempotency is the
// second layer — replays don't create duplicates even if they bypass this.
// GET /api/orders/:token is read-only and not abuse-attractive, so only
// the POST path is limited.
export const ordersPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.ORDERS_RATE_LIMIT_PER_MINUTE,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

// Standard brute-force defense for the admin credential endpoint. Only
// the seeded admin user hits this, so the UX cost is paid only on lockout.
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.ADMIN_LOGIN_RATE_LIMIT_PER_15MIN,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});
