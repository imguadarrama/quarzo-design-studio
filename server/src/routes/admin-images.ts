import { Router } from "express";
import multer from "multer";
import { authenticateAdmin } from "../middleware/authenticateAdmin.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { uploadImage } from "../lib/storage.js";
import { processImageBuffer } from "../lib/image-pipeline.js";
import { ImageUploadError } from "../lib/errors.js";

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

      const prefix =
        typeof req.body?.prefix === "string" && req.body.prefix.length > 0
          ? req.body.prefix
          : "products";

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
