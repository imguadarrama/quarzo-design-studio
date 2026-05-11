import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  deleteImageKeys,
  extractKeyFromUrl,
  uploadImage,
} from "../lib/storage.js";
import { processImageBuffer } from "../lib/image-pipeline.js";
import { ImageUploadError } from "../lib/errors.js";

const UPLOAD_PREFIXES = ["products", "products/migrated"] as const;
const uploadPrefixSchema = z.enum(UPLOAD_PREFIXES).default("products");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(
        new ImageUploadError(
          "UNSUPPORTED_MEDIA_TYPE",
          415,
          "El archivo debe ser una imagen",
        ),
      );
    }
    cb(null, true);
  },
});

export const adminImagesRouter = Router();

adminImagesRouter.use(authenticateAdmin, requireAdmin);

adminImagesRouter.post(
  "/images",
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new ImageUploadError("MISSING_FILE", 400, "Falta el archivo");
      }

      const prefix = uploadPrefixSchema.parse(req.body?.prefix);

      let processed;
      try {
        processed = await processImageBuffer(req.file.buffer);
      } catch {
        throw new ImageUploadError(
          "INVALID_IMAGE",
          422,
          "No se pudo procesar la imagen",
        );
      }

      const { url } = await uploadImage({
        buffer: processed.buffer,
        contentType: "image/jpeg",
        prefix,
      });

      res.status(201).json({
        url,
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Cleanup endpoint for the form's deferred-upload flow: when a submit
// uploads N images and then any later step fails (another upload errors,
// the product save 4xx's, etc.), the client calls this with the URLs that
// already made it into R2 so they don't become orphans. URLs outside our
// public base URL are silently filtered — extractKeyFromUrl returns null
// for those, so a client-side bug can never instruct us to delete keys
// we don't own.
const deleteSchema = z.object({
  urls: z.array(z.string().url()).max(64),
});

adminImagesRouter.delete("/images", async (req, res, next) => {
  try {
    const body = deleteSchema.parse(req.body);
    const keys = body.urls
      .map((url) => extractKeyFromUrl(url))
      .filter((k): k is string => k !== null);
    if (keys.length === 0) {
      res.json({ deleted: 0, failed: [] });
      return;
    }
    const { failed } = await deleteImageKeys(keys);
    res.json({ deleted: keys.length - failed.length, failed });
  } catch (err) {
    next(err);
  }
});
