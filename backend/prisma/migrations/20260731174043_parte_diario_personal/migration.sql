-- CreateEnum
CREATE TYPE "EstadoAsignacionDiaria" AS ENUM ('ASIGNADO', 'LIBRE', 'VACACIONES', 'AUSENTE', 'NO_CITADO');

-- CreateTable
CREATE TABLE "ParteDiario" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "titulo" TEXT,
    "notas" TEXT,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "ParteDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionDiaria" (
    "id" SERIAL NOT NULL,
    "parte_diario_id" INTEGER NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "estado" "EstadoAsignacionDiaria" NOT NULL DEFAULT 'ASIGNADO',
    "hora_ingreso" TEXT,
    "lugar" TEXT,
    "tarea" TEXT,
    "seccion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "camion_id" INTEGER,
    "vehiculo_texto" TEXT,
    "evento_id" INTEGER,
    "hora_salida" TEXT,
    "hora_salida_fija" BOOLEAN NOT NULL DEFAULT false,
    "jornada_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "AsignacionDiaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParteDiario_empresa_id_fecha_key" ON "ParteDiario"("empresa_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionDiaria_jornada_id_key" ON "AsignacionDiaria"("jornada_id");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionDiaria_parte_diario_id_empleado_id_key" ON "AsignacionDiaria"("parte_diario_id", "empleado_id");

-- AddForeignKey
ALTER TABLE "ParteDiario" ADD CONSTRAINT "ParteDiario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionDiaria" ADD CONSTRAINT "AsignacionDiaria_parte_diario_id_fkey" FOREIGN KEY ("parte_diario_id") REFERENCES "ParteDiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionDiaria" ADD CONSTRAINT "AsignacionDiaria_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionDiaria" ADD CONSTRAINT "AsignacionDiaria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionDiaria" ADD CONSTRAINT "AsignacionDiaria_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionDiaria" ADD CONSTRAINT "AsignacionDiaria_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionDiaria" ADD CONSTRAINT "AsignacionDiaria_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "Jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;
