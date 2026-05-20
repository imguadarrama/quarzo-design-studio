import { randomBytes } from "node:crypto";

export const generatePublicToken = (): string =>
  randomBytes(16).toString("hex");
