-- DropForeignKey
ALTER TABLE "SiniestroEmpleado" DROP CONSTRAINT "SiniestroEmpleado_empleado_id_fkey";

-- AlterTable
ALTER TABLE "Camion" ADD COLUMN     "capacidad_combustible" TEXT,
ADD COLUMN     "tipo_vehiculo" TEXT;

-- AlterTable
ALTER TABLE "SiniestroEmpleado" ADD COLUMN     "condicion_laboral" TEXT,
ADD COLUMN     "diagnostico" TEXT,
ADD COLUMN     "empleado_nombre_manual" TEXT,
ADD COLUMN     "plan_accion" TEXT,
ADD COLUMN     "zona_afectada" TEXT,
ADD COLUMN     "zona_riesgo" TEXT,
ALTER COLUMN "empleado_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SiniestroEmpleado" ADD CONSTRAINT "SiniestroEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
