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
    const order = await prisma.$transaction(async (tx) => {
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
