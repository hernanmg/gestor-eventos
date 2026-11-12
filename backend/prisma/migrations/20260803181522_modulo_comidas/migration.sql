-- CreateEnum
CREATE TYPE "TipoComida" AS ENUM ('ALMUERZO', 'CENA', 'DESAYUNO', 'MERIENDA');

-- DropForeignKey
ALTER TABLE "CuentaBancaria" DROP CONSTRAINT "CuentaBancaria_evento_id_fkey";

-- CreateTable
CREATE TABLE "PedidoComida" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "proveedor_id" INTEGER,
    "proveedor_texto" TEXT,
    "forma_pago" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "PedidoComida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaComida" (
    "id" SERIAL NOT NULL,
    "pedido_comida_id" INTEGER NOT NULL,
    "tipo" "TipoComida" NOT NULL,
    "area" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "valor_unitario" DECIMAL(10,2),
    "detalle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "LineaComida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoComida_evento_id_fecha_key" ON "PedidoComida"("evento_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "LineaComida_pedido_comida_id_tipo_area_key" ON "LineaComida"("pedido_comida_id", "tipo", "area");

-- AddForeignKey
ALTER TABLE "CuentaBancaria" ADD CONSTRAINT "CuentaBancaria_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoComida" ADD CONSTRAINT "PedidoComida_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoComida" ADD CONSTRAINT "PedidoComida_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoComida" ADD CONSTRAINT "PedidoComida_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaComida" ADD CONSTRAINT "LineaComida_pedido_comida_id_fkey" FOREIGN KEY ("pedido_comida_id") REFERENCES "PedidoComida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
