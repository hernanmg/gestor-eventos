-- CreateEnum
CREATE TYPE "EstadoResumenPagos" AS ENUM ('BORRADOR', 'ENVIADO', 'REVISADO', 'HISTORICO');

-- CreateEnum
CREATE TYPE "SeccionLineaPago" AS ENUM ('CAJA_SEMANAL', 'COBERTURA');

-- CreateEnum
CREATE TYPE "TipoLineaPago" AS ENUM ('JORNALEROS', 'ADELANTO', 'VIATICO', 'CAJA_CHICA', 'REPOSICION_CAJA', 'PROVEEDOR', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoLineaPago" AS ENUM ('PENDIENTE', 'APROBADA', 'OBSERVADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "ResumenPagoSemanal" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "semana_desde" TIMESTAMP(3) NOT NULL,
    "semana_hasta" TIMESTAMP(3) NOT NULL,
    "titulo" TEXT,
    "estado" "EstadoResumenPagos" NOT NULL DEFAULT 'BORRADOR',
    "notas" TEXT,
    "enviado_at" TIMESTAMP(3),
    "enviado_por" INTEGER,
    "revisado_at" TIMESTAMP(3),
    "revisado_por" INTEGER,
    "import_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "ResumenPagoSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaResumenPago" (
    "id" SERIAL NOT NULL,
    "resumen_id" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "seccion" "SeccionLineaPago" NOT NULL DEFAULT 'CAJA_SEMANAL',
    "tipo" "TipoLineaPago" NOT NULL DEFAULT 'OTRO',
    "detalle" TEXT NOT NULL,
    "importe" DECIMAL(15,2) NOT NULL,
    "observacion" TEXT,
    "origen_ref" TEXT,
    "estado" "EstadoLineaPago" NOT NULL DEFAULT 'PENDIENTE',
    "importe_aprobado" DECIMAL(15,2),
    "comentario_revision" TEXT,
    "revisado_por" INTEGER,
    "revisado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "LineaResumenPago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumenPagoSemanal_empresa_id_semana_desde_idx" ON "ResumenPagoSemanal"("empresa_id", "semana_desde");

-- CreateIndex
CREATE UNIQUE INDEX "ResumenPagoSemanal_empresa_id_import_key_key" ON "ResumenPagoSemanal"("empresa_id", "import_key");

-- CreateIndex
CREATE INDEX "LineaResumenPago_resumen_id_seccion_orden_idx" ON "LineaResumenPago"("resumen_id", "seccion", "orden");

-- AddForeignKey
ALTER TABLE "ResumenPagoSemanal" ADD CONSTRAINT "ResumenPagoSemanal_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaResumenPago" ADD CONSTRAINT "LineaResumenPago_resumen_id_fkey" FOREIGN KEY ("resumen_id") REFERENCES "ResumenPagoSemanal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

