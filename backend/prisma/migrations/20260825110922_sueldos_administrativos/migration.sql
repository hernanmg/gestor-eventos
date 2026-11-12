-- CreateEnum
CREATE TYPE "EstadoLiquidacionAdmin" AS ENUM ('BORRADOR', 'APROBADA', 'PAGADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "MovimientoCaja" ADD COLUMN     "liquidacion_admin_id" INTEGER;

-- CreateTable
CREATE TABLE "EmpleadoEmpresaSplit" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "EmpleadoEmpresaSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcuerdoSueldo" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "vigencia_meses" INTEGER,
    "escalafon" TEXT,
    "tipo_seguro" TEXT,
    "sueldo_basico" DECIMAL(12,2) NOT NULL,
    "horas_acordadas_mes" INTEGER NOT NULL DEFAULT 200,
    "premio_incentivo" DECIMAL(12,2),
    "viatico" DECIMAL(12,2),
    "premio_presentismo" DECIMAL(12,2),
    "valor_hora_extra" DECIMAL(10,2),
    "telefono" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "AcuerdoSueldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionAdmin" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "acuerdo_id" INTEGER NOT NULL,
    "periodo_mes" INTEGER NOT NULL,
    "periodo_anio" INTEGER NOT NULL,
    "sueldo_basico" DECIMAL(12,2) NOT NULL,
    "horas_acordadas" INTEGER NOT NULL,
    "escalafon" TEXT,
    "horas_trabajadas" DECIMAL(8,2) NOT NULL,
    "horas_extras" DECIMAL(8,2) NOT NULL,
    "valor_hora_extra" DECIMAL(10,2),
    "importe_horas_extras" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "premio_incentivo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "viatico" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "premio_presentismo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "antiguedad_anios" INTEGER NOT NULL DEFAULT 0,
    "importe_antiguedad" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "telefono" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vacaciones_aguinaldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vales_descuentos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal_bruto" DECIMAL(12,2) NOT NULL,
    "total_a_cobrar" DECIMAL(12,2) NOT NULL,
    "splits" JSONB,
    "estado" "EstadoLiquidacionAdmin" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "aprobado_por" INTEGER,
    "aprobado_at" TIMESTAMP(3),

    CONSTRAINT "LiquidacionAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmpleadoEmpresaSplit_empleado_id_empresa_id_key" ON "EmpleadoEmpresaSplit"("empleado_id", "empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "AcuerdoSueldo_empleado_id_key" ON "AcuerdoSueldo"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionAdmin_empleado_id_periodo_mes_periodo_anio_key" ON "LiquidacionAdmin"("empleado_id", "periodo_mes", "periodo_anio");

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_liquidacion_admin_id_fkey" FOREIGN KEY ("liquidacion_admin_id") REFERENCES "LiquidacionAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoEmpresaSplit" ADD CONSTRAINT "EmpleadoEmpresaSplit_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoEmpresaSplit" ADD CONSTRAINT "EmpleadoEmpresaSplit_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcuerdoSueldo" ADD CONSTRAINT "AcuerdoSueldo_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcuerdoSueldo" ADD CONSTRAINT "AcuerdoSueldo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionAdmin" ADD CONSTRAINT "LiquidacionAdmin_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionAdmin" ADD CONSTRAINT "LiquidacionAdmin_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionAdmin" ADD CONSTRAINT "LiquidacionAdmin_acuerdo_id_fkey" FOREIGN KEY ("acuerdo_id") REFERENCES "AcuerdoSueldo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

