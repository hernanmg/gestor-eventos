-- CreateEnum
CREATE TYPE "TipoSiniestro" AS ENUM ('ACCIDENTE_TRABAJO', 'ENFERMEDAD_LABORAL', 'ACCIDENTE_IN_ITINERE', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoSiniestro" AS ENUM ('ABIERTO', 'EN_TRAMITE', 'CERRADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "MovimientoCaja" ADD COLUMN     "categoria_andrea" TEXT;

-- CreateTable
CREATE TABLE "SiniestroEmpleado" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "tipo" "TipoSiniestro" NOT NULL,
    "fecha_ocurrencia" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "lugar" TEXT,
    "evento_id" INTEGER,
    "art_nombre" TEXT,
    "art_numero_siniestro" TEXT,
    "fecha_denuncia_art" TIMESTAMP(3),
    "estado" "EstadoSiniestro" NOT NULL DEFAULT 'ABIERTO',
    "dias_baja" INTEGER,
    "fecha_alta_medica" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "SiniestroEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoSiniestro" (
    "id" SERIAL NOT NULL,
    "siniestro_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "cubierto_art" BOOLEAN NOT NULL DEFAULT false,
    "monto_cubierto" DECIMAL(12,2),
    "monto_empresa" DECIMAL(12,2),
    "comprobante_data" BYTEA,
    "comprobante_nombre" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "GastoSiniestro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoSiniestro" (
    "id" SERIAL NOT NULL,
    "siniestro_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivo_data" BYTEA NOT NULL,
    "archivo_mime" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "DocumentoSiniestro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcedenteHoras" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "periodo_mes" INTEGER NOT NULL,
    "periodo_anio" INTEGER NOT NULL,
    "horas_excedente" DECIMAL(8,2) NOT NULL,
    "valor_hora" DECIMAL(10,2) NOT NULL,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_pago" TIMESTAMP(3),
    "liquidacion_admin_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "ExcedenteHoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExcedenteHoras_empresa_id_empleado_id_periodo_mes_periodo_a_key" ON "ExcedenteHoras"("empresa_id", "empleado_id", "periodo_mes", "periodo_anio");

-- AddForeignKey
ALTER TABLE "SiniestroEmpleado" ADD CONSTRAINT "SiniestroEmpleado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiniestroEmpleado" ADD CONSTRAINT "SiniestroEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiniestroEmpleado" ADD CONSTRAINT "SiniestroEmpleado_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoSiniestro" ADD CONSTRAINT "GastoSiniestro_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "SiniestroEmpleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoSiniestro" ADD CONSTRAINT "DocumentoSiniestro_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "SiniestroEmpleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcedenteHoras" ADD CONSTRAINT "ExcedenteHoras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcedenteHoras" ADD CONSTRAINT "ExcedenteHoras_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcedenteHoras" ADD CONSTRAINT "ExcedenteHoras_liquidacion_admin_id_fkey" FOREIGN KEY ("liquidacion_admin_id") REFERENCES "LiquidacionAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
