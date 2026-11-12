-- CreateEnum
CREATE TYPE "TipoRecorrido" AS ENUM ('PROVINCIAL', 'NACIONAL', 'NACIONAL_1000');

-- AlterTable
ALTER TABLE "AcuerdoSueldo" ADD COLUMN     "viatico_nacional" DECIMAL(10,2),
ADD COLUMN     "viatico_nacional_1000" DECIMAL(10,2),
ADD COLUMN     "viatico_provincial" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "BitacoraViaje" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "convocatoria" TEXT,
    "dia_semana" TEXT,
    "hora_inicio" TEXT,
    "hora_fin" TEXT,
    "horas_trabajadas" DECIMAL(5,2),
    "ejido" TEXT,
    "recorrido" TEXT,
    "tipo_recorrido" "TipoRecorrido" NOT NULL,
    "cantidad_vueltas" INTEGER NOT NULL DEFAULT 1,
    "valor_por_vuelta" DECIMAL(10,2),
    "viatico_calculado" DECIMAL(10,2),
    "observaciones" TEXT,
    "liquidacion_admin_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "BitacoraViaje_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BitacoraViaje" ADD CONSTRAINT "BitacoraViaje_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BitacoraViaje" ADD CONSTRAINT "BitacoraViaje_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BitacoraViaje" ADD CONSTRAINT "BitacoraViaje_liquidacion_admin_id_fkey" FOREIGN KEY ("liquidacion_admin_id") REFERENCES "LiquidacionAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
