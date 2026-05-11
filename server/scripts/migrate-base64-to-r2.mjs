// One-shot backfill: rewrites every ProductImage row whose `url` starts
// with `data:` to a CDN URL on R2. Decodes base64 → Buffer, runs the
// shared Sharp pipeline (same as POST /api/admin/images), uploads under
// `products/migrated/<uuid>.jpg`, and updates the row in place.
//
// Idempotent: after a successful pass the affected rows now have
// https URLs, so the WHERE clause returns nothing the next time.
//
// Stops on the first error so the operator can investigate before any
// further rewrites — the loop has no try/catch by design.
//
// Run order: local is a no-op (seed produces picsum URLs); staging via
// `flyctl ssh console -a $FLY_APP_STAGING-pr-<N> -C "node scripts/migrate-base64-to-r2.mjs"`;
// prod via the same form on the prod app, after a Neon snapshot.

import { prisma } from "../dist/db/prisma.js";
import { uploadImage } from "../dist/lib/storage.js";
import { processImageBuffer } from "../dist/lib/image-pipeline.js";

try {
  const rows = await prisma.productImage.findMany({
    where: { url: { startsWith: "data:" } },
    select: { id: true, url: true },
  });

  console.log(`[migrate] found ${rows.length} row(s) with data: URLs`);

  for (const row of rows) {
    const before = row.url.slice(0, 60) + "…";
    const b64 = row.url.split(",", 2)[1];
    if (!b64) throw new Error(`row ${row.id}: malformed data URL`);

    const buffer = Buffer.from(b64, "base64");
    const processed = await processImageBuffer(buffer);
    const { url } = await uploadImage({
      buffer: processed.buffer,
      contentType: "image/jpeg",
      prefix: "products/migrated",
    });

    await prisma.productImage.update({
      where: { id: row.id },
      data: { url },
    });

    console.log(`[migrate] ${row.id}: ${before}  →  ${url}`);
  }

  console.log(`[migrate] done — ${rows.length} row(s) rewritten`);
} finally {
  await prisma.$disconnect();
}
process.exit(0);
