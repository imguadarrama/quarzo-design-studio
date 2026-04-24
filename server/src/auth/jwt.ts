import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AppJwtPayload } from "./types.js";

const tokenLifetimeInSeconds = env.AUTH_TOKEN_TTL_HOURS * 60 * 60;

export const signAuthToken = (payload: AppJwtPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: tokenLifetimeInSeconds });

export const verifyAuthToken = (token: string): AppJwtPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }

  const payload = decoded as JwtPayload & Partial<AppJwtPayload>;

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid token payload");
  }

  if (payload.role !== "admin" && payload.role !== "customer") {
    throw new Error("Invalid token role");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
  };
};
