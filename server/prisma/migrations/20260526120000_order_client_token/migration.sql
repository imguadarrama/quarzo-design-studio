-- Nullable so pre-existing rows aren't blocked; new orders always set it.
ALTER TABLE "Order" ADD COLUMN "clientToken" TEXT;

CREATE UNIQUE INDEX "Order_clientToken_key" ON "Order"("clientToken");
