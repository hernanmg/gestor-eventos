-- AlterEnum
ALTER TYPE "EstadoLiquidacion" ADD VALUE 'PRE_APROBADA' BEFORE 'APROBADA';

-- AlterTable
ALTER TABLE "Liquidacion" ADD COLUMN "fecha_pago" TIMESTAMP(3),
ADD COLUMN "pre_aprobado_por" INTEGER,
ADD COLUMN "pre_aprobado_at" TIMESTAMP(3),
ADD COLUMN "pagado_por" INTEGER,
ADD COLUMN "pagado_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MovimientoCaja" ADD COLUMN "liquidacion_id" INTEGER;

-- AlterTable
ALTER TABLE "Empleado" ADD COLUMN "fecha_ingreso" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AcuerdoSueldo" ADD COLUMN "valor_premio_produccion_2" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "EventoEmpleadoMes" ADD COLUMN "nivel_premio" INTEGER;

-- CreateIndex
CREATE INDEX "Liquidacion_empresa_id_fecha_pago_idx" ON "Liquidacion"("empresa_id", "fecha_pago");

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "Liquidacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
