import type { RequestHandler } from "express";

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.auth || req.auth.role !== "admin") {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  next();
};
