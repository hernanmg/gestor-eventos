-- Ingreso al stock de lo recibido en una orden de compra (Depósito, punto 4)
ALTER TABLE "OrdenCompraItem" ADD COLUMN     "cantidad_ingresada" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "producto_id" INTEGER;

ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
