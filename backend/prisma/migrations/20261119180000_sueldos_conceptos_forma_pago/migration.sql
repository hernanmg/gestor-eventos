-- CreateEnum
CREATE TYPE "FormaPagoSueldo" AS ENUM ('TRANSFERENCIA', 'EFECTIVO', 'A_DEFINIR');

-- AlterTable
ALTER TABLE "AcuerdoSueldo" ADD COLUMN "forma_pago" "FormaPagoSueldo" NOT NULL DEFAULT 'A_DEFINIR';

-- AlterTable
ALTER TABLE "LiquidacionAdmin" ADD COLUMN "vacaciones" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "aguinaldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "extras" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "extras_detalle" TEXT,
ADD COLUMN "premios_puntuales" JSONB,
ADD COLUMN "premios_puntuales_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "monto_efectivo" DECIMAL(12,2),
ADD COLUMN "monto_transferencia" DECIMAL(12,2);

-- Lo cargado hasta hoy era un solo monto "vacaciones/aguinaldo/extras": se
-- pasa a extras, que es lo que no se puede distinguir después.
UPDATE "LiquidacionAdmin" SET "extras" = "vacaciones_aguinaldo" WHERE "vacaciones_aguinaldo" <> 0;

-- CreateTable
CREATE TABLE "PremioPuntual" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "PremioPuntual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PremioPuntual_empleado_id_idx" ON "PremioPuntual"("empleado_id");

-- AddForeignKey
ALTER TABLE "PremioPuntual" ADD CONSTRAINT "PremioPuntual_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremioPuntual" ADD CONSTRAINT "PremioPuntual_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
