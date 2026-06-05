import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ConflictError, ImageUploadError, NotFoundError } from "../lib/errors.js";

type UniqueConflictMapping = {
  code: string;
  message: string;
  field?: string;
};

// Map P2002 unique-constraint targets to per-field codes so the client can
// route the error to the right input via setError + setFocus. Composite
// targets are keyed by their column names sorted + comma-joined. Anything
// not listed falls back to UNIQUE_CONFLICT.
const UNIQUE_CONFLICT_MAP: Record<string, UniqueConflictMapping> = {
  slug: { code: "SLUG_CONFLICT", field: "slug", message: "Ese slug ya existe" },
  name: { code: "NAME_CONFLICT", field: "name", message: "Ese nombre ya existe" },
  sku: { code: "SKU_CONFLICT", field: "sku", message: "Ese SKU ya existe" },
  email: { code: "EMAIL_CONFLICT", field: "email", message: "Ese correo ya existe" },
  "name,paletteId": {
    code: "SWATCH_NAME_CONFLICT",
    message: "Ya existe una muestra con ese nombre en la paleta",
  },
};

const UNIQUE_CONFLICT_FALLBACK: UniqueConflictMapping = {
  code: "UNIQUE_CONFLICT",
  message: "Ya existe un registro con ese valor único",
};

const uniqueConflictFor = (
  err: Prisma.PrismaClientKnownRequestError,
): UniqueConflictMapping => {
  const target = err.meta?.["target"];
  let key: string | undefined;
  if (Array.isArray(target)) {
    key = [...target].sort().join(",");
  } else if (typeof target === "string") {
    key = target;
  }
  return (key ? UNIQUE_CONFLICT_MAP[key] : undefined) ?? UNIQUE_CONFLICT_FALLBACK;
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message, code: "NOT_FOUND" });
    return;
  }

  if (err instanceof ImageUploadError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message, code: err.code });
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
      const mapping = uniqueConflictFor(err);
      const body: { error: string; code: string; field?: string } = {
        error: mapping.message,
        code: mapping.code,
      };
      if (mapping.field) body.field = mapping.field;
      res.status(409).json(body);
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "No encontrado", code: "NOT_FOUND" });
      return;
    }
    if (err.code === "P2003") {
      res
        .status(400)
        .json({ error: "Referencia inválida", code: "INVALID_REFERENCE" });
      return;
    }
  }

  console.error("[errorHandler]", err);
  res.status(500).json({ error: "Error interno" });
};
