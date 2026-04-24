import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";

const isLocalDevelopment = env.APP_ENV === "development";

const resolveCookieDomain = (): string | undefined => {
  const domain = env.COOKIE_DOMAIN.trim();

  if (isLocalDevelopment || domain === "" || domain === "localhost") {
    return undefined;
  }

  return domain;
};

const buildCookieOptions = (maxAgeMs: number): CookieOptions => {
  const domain = resolveCookieDomain();

  return {
    httpOnly: true,
    sameSite: isLocalDevelopment ? "lax" : "none",
    secure: !isLocalDevelopment,
    path: "/",
    maxAge: maxAgeMs,
    ...(domain ? { domain } : {}),
  };
};

export const setAuthCookie = (response: Response, cookieName: string, token: string): void => {
  response.cookie(cookieName, token, buildCookieOptions(env.AUTH_TOKEN_TTL_HOURS * 60 * 60 * 1000));
};

export const clearAuthCookie = (response: Response, cookieName: string): void => {
  response.clearCookie(cookieName, buildCookieOptions(0));
};
