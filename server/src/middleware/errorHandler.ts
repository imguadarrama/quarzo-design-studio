import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos inválidos", issues: err.issues });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Ya existe un registro con ese valor único" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
  }

  console.error("[errorHandler]", err);
  res.status(500).json({ error: "Error interno" });
};
