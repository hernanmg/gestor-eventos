-- CreateTable
CREATE TABLE "AliasEventoPlanilla" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "nombre_planilla" TEXT NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AliasEventoPlanilla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AliasEventoPlanilla_evento_id_idx" ON "AliasEventoPlanilla"("evento_id");

-- CreateIndex
CREATE UNIQUE INDEX "AliasEventoPlanilla_empresa_id_nombre_normalizado_key" ON "AliasEventoPlanilla"("empresa_id", "nombre_normalizado");

-- AddForeignKey
ALTER TABLE "AliasEventoPlanilla" ADD CONSTRAINT "AliasEventoPlanilla_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AliasEventoPlanilla" ADD CONSTRAINT "AliasEventoPlanilla_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
