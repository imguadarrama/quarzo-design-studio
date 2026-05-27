import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { createOrderSchema } from "../lib/validation-schemas.js";
import { buildOrderItemsForCreate } from "../lib/order-write.js";
import { getShippingFee } from "../lib/shipping.js";
import { generatePublicToken } from "../lib/public-token.js";
import { orderInclude, serializeOrderPublic } from "../lib/serializers.js";
import { NotFoundError } from "../lib/errors.js";

export const ordersRouter = Router();

ordersRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createOrderSchema.parse(req.body);

    // Idempotency check: same clientToken returns the existing order so a
    // double-submit / retry / StrictMode re-run never creates duplicates.
    const existing = await prisma.order.findUnique({
      where: { clientToken: parsed.clientToken },
      include: orderInclude,
    });
    if (existing) {
      res.status(200).json({ order: serializeOrderPublic(existing) });
      return;
    }

    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        const { create, subtotal } = await buildOrderItemsForCreate(
          tx,
          parsed.items,
        );
        const shippingFee = getShippingFee(parsed.shippingMethod);
        const total = subtotal.plus(shippingFee);
        const publicToken = generatePublicToken();
        return tx.order.create({
          data: {
            publicToken,
            clientToken: parsed.clientToken,
            status: "PENDIENTE",
            customerId: null,
            email: parsed.email,
            name: parsed.name,
            phone: parsed.phone,
            shippingMethod: parsed.shippingMethod,
            shippingAddress:
              parsed.shippingAddress === null
                ? Prisma.JsonNull
                : (parsed.shippingAddress as Prisma.InputJsonValue),
            shippingFee,
            subtotal,
            total,
            paymentMethod: parsed.paymentMethod,
            notes: parsed.notes ?? null,
            items: { create },
          },
          include: orderInclude,
        });
      });
    } catch (err) {
      // Race: two concurrent posts with the same clientToken. The unique
      // constraint catches the loser; we re-look-up and return the winner's
      // row instead of bubbling the P2002 up as a 409.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = err.meta?.["target"];
        const targetStr = Array.isArray(target) ? target.join(",") : target;
        if (targetStr === "clientToken" || targetStr === "Order_clientToken_key") {
          const winner = await prisma.order.findUnique({
            where: { clientToken: parsed.clientToken },
            include: orderInclude,
          });
          if (winner) {
            res.status(200).json({ order: serializeOrderPublic(winner) });
            return;
          }
        }
      }
      throw err;
    }

    res.status(201).json({ order: serializeOrderPublic(order) });
  } catch (err) {
    next(err);
  }
});

ordersRouter.get("/:publicToken", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { publicToken: req.params.publicToken },
      include: orderInclude,
    });
    if (!order) throw new NotFoundError("Pedido no encontrado");
    res.json({ order: serializeOrderPublic(order) });
  } catch (err) {
    next(err);
  }
});
