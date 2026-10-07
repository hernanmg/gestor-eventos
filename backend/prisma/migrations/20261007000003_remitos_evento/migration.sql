-- CreateEnum
CREATE TYPE "TipoRemito" AS ENUM ('LAYHER', 'NACIONAL', 'TECHOS', 'PANOL', 'LONAS_AFORO');

-- CreateEnum
CREATE TYPE "EstadoRemito" AS ENUM ('BORRADOR', 'EMITIDO');

-- CreateTable
CREATE TABLE "RemitoEvento" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "tipo" "TipoRemito" NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cliente" TEXT,
    "domicilio" TEXT,
    "localidad" TEXT,
    "telefono" TEXT,
    "chofer" TEXT,
    "chasis_acoplado" TEXT,
    "responsable_carga" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "estado" "EstadoRemito" NOT NULL DEFAULT 'BORRADOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "RemitoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemitoEvento_empresa_id_evento_id_idx" ON "RemitoEvento"("empresa_id", "evento_id");

-- CreateIndex
CREATE UNIQUE INDEX "RemitoEvento_evento_id_tipo_numero_key" ON "RemitoEvento"("evento_id", "tipo", "numero");

-- AddForeignKey
ALTER TABLE "RemitoEvento" ADD CONSTRAINT "RemitoEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoEvento" ADD CONSTRAINT "RemitoEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

