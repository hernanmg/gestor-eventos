-- Cheques recibidos de clientes, ligados a la factura que cobran (Finanzas, punto 10)
-- CreateEnum
CREATE TYPE "EstadoChequeRecibido" AS ENUM ('EN_CARTERA', 'EN_CUSTODIA', 'DEPOSITADO', 'ACREDITADO', 'VENDIDO', 'ENDOSADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "ChequeRecibido" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "formato" "FormatoCheque" NOT NULL DEFAULT 'ECHEQ',
    "numero" TEXT NOT NULL,
    "banco" TEXT,
    "librador" TEXT NOT NULL,
    "librador_cuit" TEXT,
    "importe" DECIMAL(15,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "fecha_emision" TIMESTAMP(3),
    "fecha_pago" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoChequeRecibido" NOT NULL DEFAULT 'EN_CARTERA',
    "fecha_estado" TIMESTAMP(3),
    "factura_emitida_id" INTEGER,
    "cobro_id" INTEGER,
    "cuenta_id" INTEGER,
    "movimiento_caja_id" INTEGER,
    "banco_descuento" TEXT,
    "tasa_descuento" DECIMAL(5,2),
    "monto_neto" DECIMAL(15,2),
    "endosado_a" TEXT,
    "proveedor_id" INTEGER,
    "motivo_rechazo" TEXT,
    "notas" TEXT,
    "import_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "ChequeRecibido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChequeRecibido_movimiento_caja_id_key" ON "ChequeRecibido"("movimiento_caja_id");

-- CreateIndex
CREATE INDEX "ChequeRecibido_empresa_id_fecha_pago_idx" ON "ChequeRecibido"("empresa_id", "fecha_pago");

-- CreateIndex
CREATE UNIQUE INDEX "ChequeRecibido_empresa_id_import_key_key" ON "ChequeRecibido"("empresa_id", "import_key");

-- AddForeignKey
ALTER TABLE "ChequeRecibido" ADD CONSTRAINT "ChequeRecibido_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeRecibido" ADD CONSTRAINT "ChequeRecibido_factura_emitida_id_fkey" FOREIGN KEY ("factura_emitida_id") REFERENCES "FacturaEmitida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeRecibido" ADD CONSTRAINT "ChequeRecibido_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "CobroFacturaEmitida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeRecibido" ADD CONSTRAINT "ChequeRecibido_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "CuentaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeRecibido" ADD CONSTRAINT "ChequeRecibido_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "MovimientoCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeRecibido" ADD CONSTRAINT "ChequeRecibido_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

