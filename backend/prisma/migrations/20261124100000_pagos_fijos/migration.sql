-- Agenda de pagos fijos del mes (Finanzas, punto 17)
-- CreateEnum
CREATE TYPE "EstadoPagoFijo" AS ENUM ('PENDIENTE', 'PAGADO', 'DEBITADO', 'A_FAVOR', 'NO_CORRESPONDE');

-- CreateTable
CREATE TABLE "PagoFijo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "grupo" TEXT NOT NULL DEFAULT 'Empresa',
    "nombre" TEXT NOT NULL,
    "referencia" TEXT,
    "medio_pago" TEXT,
    "cuenta_id" INTEGER,
    "dia_vencimiento" INTEGER,
    "monto_estimado" DECIMAL(15,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "import_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PagoFijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoFijoMes" (
    "id" SERIAL NOT NULL,
    "pago_fijo_id" INTEGER NOT NULL,
    "periodo" TEXT NOT NULL,
    "vencimiento" TIMESTAMP(3),
    "monto" DECIMAL(15,2),
    "estado" "EstadoPagoFijo" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_pago" TIMESTAMP(3),
    "medio_pago" TEXT,
    "movimiento_caja_id" INTEGER,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "PagoFijoMes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoFijo_empresa_id_idx" ON "PagoFijo"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "PagoFijo_empresa_id_import_key_key" ON "PagoFijo"("empresa_id", "import_key");

-- CreateIndex
CREATE UNIQUE INDEX "PagoFijoMes_movimiento_caja_id_key" ON "PagoFijoMes"("movimiento_caja_id");

-- CreateIndex
CREATE INDEX "PagoFijoMes_periodo_idx" ON "PagoFijoMes"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "PagoFijoMes_pago_fijo_id_periodo_key" ON "PagoFijoMes"("pago_fijo_id", "periodo");

-- AddForeignKey
ALTER TABLE "PagoFijo" ADD CONSTRAINT "PagoFijo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoFijo" ADD CONSTRAINT "PagoFijo_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "CuentaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoFijoMes" ADD CONSTRAINT "PagoFijoMes_pago_fijo_id_fkey" FOREIGN KEY ("pago_fijo_id") REFERENCES "PagoFijo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoFijoMes" ADD CONSTRAINT "PagoFijoMes_movimiento_caja_id_fkey" FOREIGN KEY ("movimiento_caja_id") REFERENCES "MovimientoCaja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

