import { Decimal } from "@prisma/client/runtime/library";
import { ShippingMethod } from "@prisma/client";
import { env } from "../config/env.js";

export const getShippingFee = (method: ShippingMethod): Decimal => {
  switch (method) {
    case "PICKUP_SALTILLO":
      return new Decimal(0);
    case "NACIONAL":
      return new Decimal(env.SHIPPING_FLAT_RATE_MXN);
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
};
