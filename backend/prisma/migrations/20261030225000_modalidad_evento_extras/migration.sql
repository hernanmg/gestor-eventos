-- CreateEnum
CREATE TYPE "ModalidadEvento" AS ENUM ('FLUJO_CAJA', 'CENTRO_COSTOS');

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "modalidad" "ModalidadEvento" NOT NULL DEFAULT 'FLUJO_CAJA';

-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN     "plazo_pago" TEXT;

-- AlterTable
ALTER TABLE "PreMacro" ADD COLUMN     "modalidad" "ModalidadEvento" NOT NULL DEFAULT 'CENTRO_COSTOS';

-- CreateTable
CREATE TABLE "ExtraEvento" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "responsable" TEXT,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "neto" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "plazo_pago" TEXT,
    "datos_cuenta" TEXT,
    "factura" TEXT,
    "notas" TEXT,
    "a_cargo_cliente" BOOLEAN NOT NULL DEFAULT true,
    "movimiento_id" INTEGER,
    "comprobante_data" BYTEA,
    "comprobante_nombre" TEXT,
    "comprobante_mime" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "ExtraEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtraEvento_movimiento_id_key" ON "ExtraEvento"("movimiento_id");

-- CreateIndex
CREATE INDEX "ExtraEvento_evento_id_idx" ON "ExtraEvento"("evento_id");

-- AddForeignKey
ALTER TABLE "ExtraEvento" ADD CONSTRAINT "ExtraEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraEvento" ADD CONSTRAINT "ExtraEvento_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

