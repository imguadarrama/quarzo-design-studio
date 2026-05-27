// Server smoke (§4i) for PR #45 — exercises POST/GET /api/orders against a
// running local stack. Discovers fixtures from the public product API, so it
// only needs a seeded DB (pnpm seed). Re-run after every change to the order
// route or its validation helpers.
//
// Usage: with `pnpm dev` up, run `node server/scripts/smoke-orders.mjs`.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const ALL_KINDS = [
  "CON_FOIL",
  "CON_TINTA_NORMAL",
  "CON_FOIL_Y_TINTA",
  "PAPEL_TEXTURIZADO",
];
// Valid cuid format (^c[a-z0-9]{24}$) that won't resolve to any row. Used for
// invalid-swatch (case 5) and design-not-on-product (case 7) — both server
// branches treat "not found" identically.
const FAKE_SWATCH_CUID = "cltest000000000000000abcde";
const FAKE_DESIGN_CUID = "cltest000000000000000fghij";

const results = [];
const record = (n, label, fn) => {
  results.push({ n, label, fn });
};

const request = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* some 4xx may be empty */
  }
  return { status: res.status, body: json };
};

const die = (msg) => {
  console.error(`\nFixture discovery failed: ${msg}`);
  console.error("Hint: run `pnpm seed` to populate a foil-bearing product with designs.");
  process.exit(2);
};

const discoverFixtures = async () => {
  const list = await request("GET", "/api/products");
  if (list.status !== 200 || !Array.isArray(list.body?.products)) {
    die(`GET /api/products → ${list.status}`);
  }

  let foilProduct = null;
  let foilSwatchId = null;
  let foilDesignId = null;
  let unofferedProductId = null;
  let unofferedKind = null;
  let otherDesignId = null;

  // Cache /api/products/:slug detail payloads to avoid re-fetching.
  const detailBySlug = new Map();
  for (const p of list.body.products) {
    const detail = await request("GET", `/api/products/${p.slug}`);
    if (detail.status === 200) detailBySlug.set(p.slug, detail.body.product);
  }

  for (const prod of detailBySlug.values()) {
    const foilVariant = prod.variants.find(
      (v) => v.kind === "CON_FOIL" && v.palette?.swatches?.length,
    );
    if (!foilVariant) continue;
    const design = prod.designs.find((d) => d.compatibleKinds.includes("CON_FOIL"));
    if (!design) continue;
    foilProduct = prod;
    foilSwatchId = foilVariant.palette.swatches[0].id;
    foilDesignId = design.id;
    break;
  }
  if (!foilProduct) {
    die("no product with offered CON_FOIL variant + foil-compat design + non-empty foil palette");
  }

  // Case 6 needs a product+kind where the kind is NOT offered. Scan everything.
  for (const prod of detailBySlug.values()) {
    const offered = new Set(prod.variants.map((v) => v.kind));
    const missing = ALL_KINDS.find((k) => !offered.has(k));
    if (missing) {
      unofferedProductId = prod.id;
      unofferedKind = missing;
      break;
    }
  }
  if (!unofferedKind) {
    die("no product with an unoffered variant kind — toggle one off in /admin/productos so case 6 can run");
  }

  return {
    foilProduct,
    foilSwatchId,
    foilDesignId,
    unofferedProductId,
    unofferedKind,
  };
};

const baseOrder = (overrides) => ({
  clientToken: randomUUID(),
  email: "smoke@quarzo.test",
  name: "Smoke Test",
  phone: "8444445555",
  shippingMethod: "NACIONAL",
  shippingAddress: {
    calle: "Av Prueba",
    numero: "123",
    colonia: "Centro",
    ciudad: "Saltillo",
    estado: "Coahuila",
    codigoPostal: "25000",
  },
  paymentMethod: "TRANSFERENCIA",
  items: [],
  ...overrides,
});

const foilItem = (fx, over = {}) => ({
  productId: fx.foilProduct.id,
  variantKind: "CON_FOIL",
  designId: fx.foilDesignId,
  foilSwatchId: fx.foilSwatchId,
  personalizationText: "Ana López",
  quantity: 1,
  ...over,
});

const run = async () => {
  const fx = await discoverFixtures();
  const foilVariant = fx.foilProduct.variants.find((v) => v.kind === "CON_FOIL");
  const unitPrice = Number(foilVariant.price);
  let happyToken = null;
  let happyBody = null;

  record(1, "happy path TRANSFERENCIA+NACIONAL → 201, totals correct", async () => {
    const r = await request("POST", "/api/orders", baseOrder({
      items: [foilItem(fx, { quantity: 2 })],
    }));
    assert.equal(r.status, 201, `status ${r.status} body ${JSON.stringify(r.body)}`);
    const o = r.body.order;
    assert.equal(Number(o.subtotal), unitPrice * 2);
    assert.ok(Number(o.shippingFee) > 0, "expected non-zero NACIONAL shipping fee");
    assert.equal(Number(o.total), Number(o.subtotal) + Number(o.shippingFee));
    assert.ok(o.publicToken && o.publicToken.length >= 32);
    happyToken = o.publicToken;
    happyBody = o;
    return `subtotal=${o.subtotal} shipping=${o.shippingFee} total=${o.total}`;
  });

  record(2, "PICKUP_SALTILLO + null address → 201, shippingFee 0.00", async () => {
    const r = await request("POST", "/api/orders", baseOrder({
      shippingMethod: "PICKUP_SALTILLO",
      shippingAddress: null,
      items: [foilItem(fx)],
    }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.order.shippingFee, "0.00");
    return `total=${r.body.order.total}`;
  });

  record(3, "PICKUP_SALTILLO + non-null address → 400 ADDRESS_NOT_ALLOWED_FOR_PICKUP", async () => {
    const r = await request("POST", "/api/orders", baseOrder({
      shippingMethod: "PICKUP_SALTILLO",
      items: [foilItem(fx)],
    }));
    assert.equal(r.status, 400, JSON.stringify(r.body));
    const issue = r.body.issues?.find(
      (i) => i?.params?.code === "ADDRESS_NOT_ALLOWED_FOR_PICKUP",
    );
    assert.ok(issue, `missing ADDRESS_NOT_ALLOWED_FOR_PICKUP in ${JSON.stringify(r.body.issues)}`);
    return "zod issue present";
  });

  record(4, "foil + null swatch → 409 FOIL_SWATCH_REQUIRED", async () => {
    const r = await request("POST", "/api/orders", baseOrder({
      items: [foilItem(fx, { foilSwatchId: null })],
    }));
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.code, "FOIL_SWATCH_REQUIRED");
    return r.body.code;
  });

  record(5, "foil + bogus swatch id → 409 FOIL_SWATCH_INVALID", async () => {
    const r = await request("POST", "/api/orders", baseOrder({
      items: [foilItem(fx, { foilSwatchId: FAKE_SWATCH_CUID })],
    }));
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.code, "FOIL_SWATCH_INVALID");
    return r.body.code;
  });

  record(6, `unoffered variant kind (${fx.unofferedKind}) → 409 VARIANT_NOT_OFFERED`, async () => {
    // Variant offered-check runs before design-check server-side, so we can
    // reuse foilDesignId as a cuid-shaped placeholder — the lookup never runs.
    const r = await request("POST", "/api/orders", baseOrder({
      items: [foilItem(fx, {
        productId: fx.unofferedProductId,
        variantKind: fx.unofferedKind,
        foilSwatchId: null,
      })],
    }));
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.code, "VARIANT_NOT_OFFERED");
    return r.body.code;
  });

  record(7, "design not on product → 409 DESIGN_INCOMPATIBLE", async () => {
    const r = await request("POST", "/api/orders", baseOrder({
      items: [foilItem(fx, { designId: FAKE_DESIGN_CUID })],
    }));
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.code, "DESIGN_INCOMPATIBLE");
    return r.body.code;
  });

  record(8, "GET /api/orders/<token> → 200, item snapshots populated", async () => {
    assert.ok(happyToken, "case 1 must run before case 8");
    const r = await request("GET", `/api/orders/${happyToken}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const item = r.body.order.items[0];
    for (const k of ["productName", "variantName", "unitPrice", "sku", "designId", "designName", "designImageUrl"]) {
      assert.ok(item[k], `item.${k} missing/empty (got ${item[k]})`);
    }
    return `sku=${item.sku} design=${item.designName}`;
  });

  record(9, "GET /api/orders/<tampered> → 404 NOT_FOUND", async () => {
    const r = await request("GET", "/api/orders/00000000000000000000000000000000");
    assert.equal(r.status, 404, JSON.stringify(r.body));
    assert.equal(r.body.code, "NOT_FOUND");
    return r.body.code;
  });

  record(10, 'order payload has no top-level "id" field', async () => {
    assert.ok(happyBody, "case 1 must run before case 10");
    assert.equal(typeof happyBody.id, "undefined", `unexpected order.id=${happyBody.id}`);
    return "id absent";
  });

  // Cases 11 + 12 share state to keep the total POST count under the rate
  // limiter's per-minute budget.
  let publicTokenA = null;

  record(11, "same clientToken → same publicToken, second call returns 200", async () => {
    const payload = baseOrder({
      clientToken: randomUUID(),
      items: [foilItem(fx)],
    });
    const first = await request("POST", "/api/orders", payload);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await request("POST", "/api/orders", payload);
    assert.equal(second.status, 200, `replay status ${second.status} body ${JSON.stringify(second.body)}`);
    assert.equal(
      second.body.order.publicToken,
      first.body.order.publicToken,
      "replay must return the same publicToken",
    );
    publicTokenA = first.body.order.publicToken;
    return `publicToken=${publicTokenA.slice(0, 8)}…`;
  });

  record(12, "different clientToken with same payload → distinct order", async () => {
    assert.ok(publicTokenA, "case 11 must run before case 12");
    const r = await request("POST", "/api/orders", baseOrder({
      items: [foilItem(fx)],
    }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.notEqual(
      r.body.order.publicToken,
      publicTokenA,
      "distinct clientTokens must create distinct orders",
    );
    return "distinct publicToken";
  });

  let passed = 0;
  for (const { n, label, fn } of results) {
    try {
      const detail = await fn();
      passed++;
      console.log(`✓ ${String(n).padStart(2)}  ${label}${detail ? `  (${detail})` : ""}`);
    } catch (err) {
      console.log(`✗ ${String(n).padStart(2)}  ${label}`);
      console.log(`     ${err.message}`);
    }
  }
  console.log(`\nSmoke: ${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};

run().catch((err) => {
  console.error("Smoke script crashed:", err);
  process.exit(1);
});
