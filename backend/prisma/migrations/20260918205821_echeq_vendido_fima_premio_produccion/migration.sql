-- AlterEnum
ALTER TYPE "EstadoEcheq" ADD VALUE 'VENDIDO';

-- AlterEnum
ALTER TYPE "TipoCuenta" ADD VALUE 'FIMA';

-- AlterTable
ALTER TABLE "AcuerdoSueldo" ADD COLUMN     "cobra_premio_produccion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valor_premio_produccion" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Echeq" ADD COLUMN     "banco_descuento" TEXT,
ADD COLUMN     "fecha_venta" TIMESTAMP(3),
ADD COLUMN     "monto_neto_recibido" DECIMAL(15,2),
ADD COLUMN     "tasa_descuento" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "LiquidacionAdmin" ADD COLUMN     "eventos_mes" JSONB,
ADD COLUMN     "premio_produccion_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "premio_viaje" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EventoEmpleadoMes" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "evento_id" INTEGER,
    "evento_nombre" TEXT,
    "periodo_mes" INTEGER NOT NULL,
    "periodo_anio" INTEGER NOT NULL,
    "cobra_premio" BOOLEAN NOT NULL DEFAULT true,
    "monto_premio" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "EventoEmpleadoMes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventoEmpleadoMes_empleado_id_evento_id_periodo_mes_periodo_key" ON "EventoEmpleadoMes"("empleado_id", "evento_id", "periodo_mes", "periodo_anio");

-- AddForeignKey
ALTER TABLE "EventoEmpleadoMes" ADD CONSTRAINT "EventoEmpleadoMes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoEmpleadoMes" ADD CONSTRAINT "EventoEmpleadoMes_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoEmpleadoMes" ADD CONSTRAINT "EventoEmpleadoMes_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
