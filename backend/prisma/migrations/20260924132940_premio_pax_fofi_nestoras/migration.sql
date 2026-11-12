-- CreateEnum
CREATE TYPE "EstadoSiniestroVehiculo" AS ENUM ('ABIERTO', 'EN_PROCESO', 'RESUELTO', 'SIN_NOVEDAD');

-- AlterTable
ALTER TABLE "EventoEmpleadoMes" ADD COLUMN     "cantidad_pax" INTEGER,
ADD COLUMN     "dias_trabajados" INTEGER DEFAULT 1,
ADD COLUMN     "premio_pax_total" DECIMAL(12,2),
ADD COLUMN     "valor_por_pax" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "EntregaUniforme" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "empleado_id" INTEGER,
    "empleado_nombre" TEXT NOT NULL,
    "fecha_entrega" TIMESTAMP(3) NOT NULL,
    "borcegos" INTEGER NOT NULL DEFAULT 0,
    "remeras" INTEGER NOT NULL DEFAULT 0,
    "camperon" INTEGER NOT NULL DEFAULT 0,
    "chombas" INTEGER NOT NULL DEFAULT 0,
    "campera" INTEGER NOT NULL DEFAULT 0,
    "mochila" INTEGER NOT NULL DEFAULT 0,
    "buzo" INTEGER NOT NULL DEFAULT 0,
    "pantalon" INTEGER NOT NULL DEFAULT 0,
    "bermuda" INTEGER NOT NULL DEFAULT 0,
    "gorra" INTEGER NOT NULL DEFAULT 0,
    "prot_lumbar" INTEGER NOT NULL DEFAULT 0,
    "guantes" INTEGER NOT NULL DEFAULT 0,
    "otros" TEXT,
    "origen_hoja" TEXT NOT NULL DEFAULT 'MANUAL',
    "anio_resumen" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "EntregaUniforme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiniestroVehiculo" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "camion_id" INTEGER,
    "patente_texto" TEXT,
    "empleado_id" INTEGER,
    "empleado_nombre_manual" TEXT,
    "aseguradora" TEXT,
    "numero_siniestro" TEXT,
    "fecha_denuncia" TIMESTAMP(3),
    "fecha_ocurrencia" TIMESTAMP(3) NOT NULL,
    "lugar" TEXT,
    "descripcion" TEXT,
    "danios" TEXT,
    "tercero_nombre" TEXT,
    "tercero_vehiculo" TEXT,
    "tercero_seguro" TEXT,
    "estado" "EstadoSiniestroVehiculo" NOT NULL DEFAULT 'ABIERTO',
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "SiniestroVehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntregaUniforme_empleado_id_idx" ON "EntregaUniforme"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaUniforme_empresa_id_empleado_nombre_fecha_entrega_or_key" ON "EntregaUniforme"("empresa_id", "empleado_nombre", "fecha_entrega", "origen_hoja");

-- CreateIndex
CREATE UNIQUE INDEX "SiniestroVehiculo_empresa_id_numero_siniestro_key" ON "SiniestroVehiculo"("empresa_id", "numero_siniestro");

-- AddForeignKey
ALTER TABLE "EntregaUniforme" ADD CONSTRAINT "EntregaUniforme_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaUniforme" ADD CONSTRAINT "EntregaUniforme_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiniestroVehiculo" ADD CONSTRAINT "SiniestroVehiculo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiniestroVehiculo" ADD CONSTRAINT "SiniestroVehiculo_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiniestroVehiculo" ADD CONSTRAINT "SiniestroVehiculo_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
