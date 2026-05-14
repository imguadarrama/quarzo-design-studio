import { Prisma, VariantKind } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

export const KIND_SHORT: Record<VariantKind, string> = {
  CON_FOIL: "foil",
  CON_TINTA_NORMAL: "tinta",
  CON_FOIL_Y_TINTA: "foiltinta",
  PAPEL_TEXTURIZADO: "tex",
};

const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LEN = 4;
const SLUG_PREFIX_MAX = 60;
const MAX_ATTEMPTS = 8;

export const generateSkuSuffix = (): string => {
  const bytes = randomBytes(SUFFIX_LEN);
  let out = "";
  for (const byte of bytes) {
    out += SUFFIX_ALPHABET.charAt(byte % SUFFIX_ALPHABET.length);
  }
  return out;
};

const truncateSlug = (slug: string): string =>
  slug.length <= SLUG_PREFIX_MAX ? slug : slug.slice(0, SLUG_PREFIX_MAX);

export const buildSkuCandidate = (
  slug: string,
  kind: VariantKind,
  suffix: string,
): string => `${truncateSlug(slug)}-${KIND_SHORT[kind]}-${suffix}`;

// Extracts the 4-char suffix from an existing SKU so PATCH can preserve it
// across slug edits. Returns null if the SKU doesn't match our shape (e.g.,
// hand-edited via the DB) — caller falls back to a fresh random suffix.
export const extractSkuSuffix = (sku: string): string | null => {
  const parts = sku.split("-");
  const tail = parts[parts.length - 1];
  if (!tail || tail.length !== SUFFIX_LEN) return null;
  for (const ch of tail) {
    if (!SUFFIX_ALPHABET.includes(ch)) return null;
  }
  return tail;
};

type TxLike = Pick<PrismaClient, "productVariantPrice"> | Prisma.TransactionClient;

// Try `preferredSuffix` first if provided (PATCH path: keeps the per-row 4-char
// suffix stable across slug edits). On `P2002` collision, retry with fresh
// suffixes up to MAX_ATTEMPTS. Bail loud if we can't find a unique SKU.
export const ensureUniqueSku = async (
  tx: TxLike,
  slug: string,
  kind: VariantKind,
  preferredSuffix?: string,
): Promise<string> => {
  const tried = new Set<string>();
  const trySuffix = async (suffix: string): Promise<string | null> => {
    if (tried.has(suffix)) return null;
    tried.add(suffix);
    const candidate = buildSkuCandidate(slug, kind, suffix);
    const existing = await tx.productVariantPrice.findUnique({
      where: { sku: candidate },
      select: { productId: true },
    });
    return existing ? null : candidate;
  };

  if (preferredSuffix) {
    const hit = await trySuffix(preferredSuffix);
    if (hit) return hit;
  }
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const hit = await trySuffix(generateSkuSuffix());
    if (hit) return hit;
  }
  throw new Error(
    `Could not generate a unique SKU for slug=${slug} kind=${kind} after ${MAX_ATTEMPTS} attempts`,
  );
};
