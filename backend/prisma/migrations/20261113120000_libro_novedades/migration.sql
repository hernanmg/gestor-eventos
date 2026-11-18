-- CreateEnum
CREATE TYPE "GravedadNovedad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "EstadoNovedad" AS ENUM ('ABIERTA', 'EN_CURSO', 'RESUELTA');

-- CreateTable
CREATE TABLE "TipoNovedad" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "avisar_usuario_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "TipoNovedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Novedad" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "lugar" TEXT,
    "gravedad" "GravedadNovedad" NOT NULL DEFAULT 'MEDIA',
    "estado" "EstadoNovedad" NOT NULL DEFAULT 'ABIERTA',
    "reportado_por" TEXT,
    "responsable_id" INTEGER,
    "evento_id" INTEGER,
    "camion_id" INTEGER,
    "empleado_id" INTEGER,
    "proveedor_id" INTEGER,
    "resolucion" TEXT,
    "resuelta_at" TIMESTAMP(3),
    "resuelta_por" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjuntoNovedad" (
    "id" SERIAL NOT NULL,
    "novedad_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanio" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "AdjuntoNovedad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoNovedad_empresa_id_nombre_key" ON "TipoNovedad"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "Novedad_empresa_id_estado_gravedad_idx" ON "Novedad"("empresa_id", "estado", "gravedad");

-- CreateIndex
CREATE INDEX "Novedad_empresa_id_fecha_idx" ON "Novedad"("empresa_id", "fecha");

-- CreateIndex
CREATE INDEX "Novedad_evento_id_idx" ON "Novedad"("evento_id");

-- CreateIndex
CREATE INDEX "Novedad_camion_id_idx" ON "Novedad"("camion_id");

-- CreateIndex
CREATE INDEX "AdjuntoNovedad_novedad_id_idx" ON "AdjuntoNovedad"("novedad_id");

-- AddForeignKey
ALTER TABLE "TipoNovedad" ADD CONSTRAINT "TipoNovedad_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "TipoNovedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjuntoNovedad" ADD CONSTRAINT "AdjuntoNovedad_novedad_id_fkey" FOREIGN KEY ("novedad_id") REFERENCES "Novedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

