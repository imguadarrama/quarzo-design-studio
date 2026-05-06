import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ImageUploadError, NotFoundError } from "../lib/errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message, code: "NOT_FOUND" });
    return;
  }

  if (err instanceof ImageUploadError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "El archivo supera el tamaño máximo permitido",
        code: "FILE_TOO_LARGE",
      });
      return;
    }
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos inválidos", issues: err.issues });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        error: "Ya existe un registro con ese valor único",
        code: "SLUG_CONFLICT",
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "No encontrado", code: "NOT_FOUND" });
      return;
    }
  }

  console.error("[errorHandler]", err);
  res.status(500).json({ error: "Error interno" });
};
