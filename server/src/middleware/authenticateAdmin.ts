import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { verifyAuthToken } from "../auth/jwt.js";

export const authenticateAdmin: RequestHandler = (req, _res, next) => {
  const token = req.cookies[env.ADMIN_AUTH_COOKIE_NAME];

  if (typeof token !== "string" || token.length === 0) {
    req.auth = undefined;
    next();
    return;
  }

  try {
    const payload = verifyAuthToken(token);

    if (payload.role !== "admin") {
      req.auth = undefined;
      next();
      return;
    }

    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    req.auth = undefined;
  }

  next();
};
