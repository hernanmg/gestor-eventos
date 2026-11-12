-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'TARDE', 'MEDIA_JORNADA', 'AUSENTE', 'JUSTIFICADO', 'LIBRE', 'VACACIONES', 'LICENCIA');

-- AlterTable
ALTER TABLE "Empleado" ADD COLUMN     "hora_convocatoria_default" TEXT;

-- CreateTable
CREATE TABLE "RegistroAsistencia" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE',
    "hora_ingreso" TEXT,
    "hora_egreso" TEXT,
    "horas_trabajadas" DECIMAL(5,2),
    "minutos_tardanza" INTEGER,
    "motivo" TEXT,
    "descuenta_presentismo" BOOLEAN NOT NULL DEFAULT false,
    "jornada_id" INTEGER,
    "origen" TEXT,
    "tardanza_requiere_aprobacion" BOOLEAN NOT NULL DEFAULT false,
    "tardanza_aprobada" BOOLEAN,
    "tardanza_aprobada_por" INTEGER,
    "tardanza_aprobada_at" TIMESTAMP(3),
    "tardanza_nota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "RegistroAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumenPresentismo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "periodo_mes" INTEGER NOT NULL,
    "periodo_anio" INTEGER NOT NULL,
    "dias_habiles" INTEGER NOT NULL DEFAULT 0,
    "dias_presente" INTEGER NOT NULL DEFAULT 0,
    "dias_tarde" INTEGER NOT NULL DEFAULT 0,
    "dias_media_jornada" INTEGER NOT NULL DEFAULT 0,
    "dias_ausente" INTEGER NOT NULL DEFAULT 0,
    "dias_justificado" INTEGER NOT NULL DEFAULT 0,
    "dias_libre" INTEGER NOT NULL DEFAULT 0,
    "dias_vacaciones" INTEGER NOT NULL DEFAULT 0,
    "total_horas" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "total_tardanzas_min" INTEGER NOT NULL DEFAULT 0,
    "cobra_presentismo" BOOLEAN NOT NULL DEFAULT true,
    "motivo_sin_presentismo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumenPresentismo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAsistencia_jornada_id_key" ON "RegistroAsistencia"("jornada_id");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAsistencia_empresa_id_empleado_id_fecha_key" ON "RegistroAsistencia"("empresa_id", "empleado_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ResumenPresentismo_empresa_id_empleado_id_periodo_mes_perio_key" ON "ResumenPresentismo"("empresa_id", "empleado_id", "periodo_mes", "periodo_anio");

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "Jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenPresentismo" ADD CONSTRAINT "ResumenPresentismo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumenPresentismo" ADD CONSTRAINT "ResumenPresentismo_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
