import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { clearAuthCookie, setAuthCookie } from "../auth/cookies.js";
import { signAuthToken } from "../auth/jwt.js";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const adminAuthRouter = Router();

adminAuthRouter.post("/login", async (req, res) => {
  const parsed = adminLoginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password } = parsed.data;
  const adminUser = await prisma.adminUser.findUnique({ where: { email } });

  if (!adminUser) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, adminUser.passwordHash);

  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signAuthToken({
    sub: adminUser.id,
    email: adminUser.email,
    role: "admin",
  });

  setAuthCookie(res, env.ADMIN_AUTH_COOKIE_NAME, token);

  res.json({
    admin: {
      id: adminUser.id,
      email: adminUser.email,
    },
  });
});

adminAuthRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res, env.ADMIN_AUTH_COOKIE_NAME);
  res.status(204).send();
});

adminAuthRouter.get("/me", authenticateAdmin, requireAdmin, (req, res) => {
  res.json({
    admin: {
      id: req.auth!.userId,
      email: req.auth!.email,
    },
  });
});
