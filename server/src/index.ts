import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { adminProductsRouter } from "./routes/admin-products.js";
import { env } from "./config/env.js";
import { adminAuthRouter } from "./routes/admin-auth.js";
import { adminImagesRouter } from "./routes/admin-images.js";
import { healthRouter } from "./routes/health.js";
import { productsRouter } from "./routes/products.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

const previewOriginRegex = env.CLIENT_ORIGIN_PREVIEW_PATTERN
  ? new RegExp(env.CLIENT_ORIGIN_PREVIEW_PATTERN)
  : null;

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin === env.CLIENT_ORIGIN) return cb(null, true);
      if (previewOriginRegex && previewOriginRegex.test(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.use("/api", healthRouter);
app.use("/api", productsRouter);
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin", adminProductsRouter);
app.use("/api/admin", adminImagesRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});
