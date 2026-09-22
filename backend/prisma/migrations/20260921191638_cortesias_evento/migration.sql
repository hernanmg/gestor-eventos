-- CreateTable
CREATE TABLE "CortesiaEvento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "cliente_nombre" TEXT NOT NULL,
    "contacto_nombre" TEXT,
    "autorizado_por" TEXT,
    "observacion" TEXT,
    "visado" BOOLEAN NOT NULL DEFAULT false,
    "entregado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "CortesiaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CortesiaItem" (
    "id" SERIAL NOT NULL,
    "cortesia_id" INTEGER NOT NULL,
    "tipo_ticket" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "bib_number" TEXT,
    "nombre_inscripto" TEXT,
    "apellido_inscripto" TEXT,
    "dni" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CortesiaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CortesiaEvento_evento_id_deleted_at_idx" ON "CortesiaEvento"("evento_id", "deleted_at");

-- CreateIndex
CREATE INDEX "CortesiaItem_cortesia_id_idx" ON "CortesiaItem"("cortesia_id");

-- AddForeignKey
ALTER TABLE "CortesiaEvento" ADD CONSTRAINT "CortesiaEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CortesiaEvento" ADD CONSTRAINT "CortesiaEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CortesiaItem" ADD CONSTRAINT "CortesiaItem_cortesia_id_fkey" FOREIGN KEY ("cortesia_id") REFERENCES "CortesiaEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
