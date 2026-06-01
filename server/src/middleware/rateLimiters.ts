import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../config/env.js";

const handler: Options["handler"] = (_req, res) => {
  res.status(429).json({
    error: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
    code: "RATE_LIMITED",
  });
};

export const ordersPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.ORDERS_RATE_LIMIT_PER_MINUTE,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.ADMIN_LOGIN_RATE_LIMIT_PER_15MIN,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});
