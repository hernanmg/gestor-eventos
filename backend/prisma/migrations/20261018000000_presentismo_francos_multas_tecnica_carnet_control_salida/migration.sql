-- CreateEnum
CREATE TYPE "SemaforoPresentismo" AS ENUM ('EXCELENTE', 'SEGUIMIENTO', 'ATENCION');

-- CreateEnum
CREATE TYPE "TipoMulta" AS ENUM ('TRANSITO', 'INTERNA');

-- CreateEnum
CREATE TYPE "EstadoMulta" AS ENUM ('PENDIENTE', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoControlSalida" AS ENUM ('PENDIENTE', 'REVISADO', 'OBSERVADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoAsistencia" ADD VALUE 'DEMORA';
ALTER TYPE "EstadoAsistencia" ADD VALUE 'FRANCO';

-- AlterTable
ALTER TABLE "Camion" ADD COLUMN     "tipo_tecnica" TEXT,
ADD COLUMN     "vencimiento_tecnica" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Empleado" ADD COLUMN     "francos_saldo_inicial" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "licencia_categoria" TEXT,
ADD COLUMN     "licencia_numero" TEXT,
ADD COLUMN     "licencia_vencimiento" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RegistroAsistencia" ADD COLUMN     "hora_convocatoria" TEXT;

-- AlterTable
ALTER TABLE "ResumenPresentismo" ADD COLUMN     "dias_demora" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dias_franco" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "francos_ganados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "semaforo" "SemaforoPresentismo" NOT NULL DEFAULT 'EXCELENTE';

-- CreateTable
CREATE TABLE "Multa" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" "TipoMulta" NOT NULL DEFAULT 'TRANSITO',
    "fecha" TIMESTAMP(3) NOT NULL,
    "camion_id" INTEGER,
    "patente_texto" TEXT,
    "empleado_id" INTEGER,
    "empleado_nombre_manual" TEXT,
    "lugar" TEXT,
    "motivo" TEXT NOT NULL,
    "numero_acta" TEXT,
    "fecha_vencimiento" TIMESTAMP(3),
    "monto" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoMulta" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_pago" TIMESTAMP(3),
    "medio_pago" TEXT,
    "descontar_empleado" BOOLEAN NOT NULL DEFAULT false,
    "anticipo_id" INTEGER,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "Multa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlSalidaVehiculo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "fecha_salida" TIMESTAMP(3) NOT NULL,
    "chofer_id" INTEGER,
    "chofer_nombre" TEXT,
    "evento_id" INTEGER,
    "destino" TEXT,
    "check_tarjeta_verde" BOOLEAN NOT NULL DEFAULT false,
    "check_seguro" BOOLEAN NOT NULL DEFAULT false,
    "check_tecnica" BOOLEAN NOT NULL DEFAULT false,
    "check_carnet" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoControlSalida" NOT NULL DEFAULT 'PENDIENTE',
    "revisado_por" TEXT,
    "revisado_at" TIMESTAMP(3),
    "alertas_al_cerrar" JSONB,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "ControlSalidaVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Multa_anticipo_id_key" ON "Multa"("anticipo_id");

-- CreateIndex
CREATE INDEX "Multa_empresa_id_fecha_idx" ON "Multa"("empresa_id", "fecha");

-- CreateIndex
CREATE INDEX "ControlSalidaVehiculo_empresa_id_fecha_salida_idx" ON "ControlSalidaVehiculo"("empresa_id", "fecha_salida");

-- AddForeignKey
ALTER TABLE "Multa" ADD CONSTRAINT "Multa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Multa" ADD CONSTRAINT "Multa_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Multa" ADD CONSTRAINT "Multa_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Multa" ADD CONSTRAINT "Multa_anticipo_id_fkey" FOREIGN KEY ("anticipo_id") REFERENCES "Anticipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSalidaVehiculo" ADD CONSTRAINT "ControlSalidaVehiculo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSalidaVehiculo" ADD CONSTRAINT "ControlSalidaVehiculo_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSalidaVehiculo" ADD CONSTRAINT "ControlSalidaVehiculo_chofer_id_fkey" FOREIGN KEY ("chofer_id") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlSalidaVehiculo" ADD CONSTRAINT "ControlSalidaVehiculo_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: la pizarra guardaba la revisión técnica como texto en Camion.notas
-- ("RTO 27/9/2026", "ITV 16/07/27"). Se pasa a tipo_tecnica/vencimiento_tecnica
-- y se limpia la nota. Fechas inválidas quedan como estaban (en notas).
DO $$
DECLARE
  r RECORD;
  m TEXT[];
  v_anio INT;
BEGIN
  FOR r IN SELECT id, notas FROM "Camion" WHERE notas ~* '^[[:space:]]*(RTO|ITV|ITU|VTV)[[:space:]]+[0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4}[[:space:]]*$' LOOP
    m := regexp_match(r.notas, '^[[:space:]]*(RTO|ITV|ITU|VTV)[[:space:]]+([0-9]{1,2})/([0-9]{1,2})/([0-9]{2,4})[[:space:]]*$', 'i');
    v_anio := m[4]::int;
    IF v_anio < 100 THEN v_anio := v_anio + 2000; END IF;
    BEGIN
      UPDATE "Camion"
         SET tipo_tecnica = upper(m[1]),
             vencimiento_tecnica = make_date(v_anio, m[3]::int, m[2]::int)::timestamp,
             notas = NULL
       WHERE id = r.id;
    EXCEPTION WHEN others THEN
      -- fecha inexistente (ej. 31/04): se deja la nota tal cual
      NULL;
    END;
  END LOOP;
END $$;
