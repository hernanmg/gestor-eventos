-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN     "iva" DECIMAL(15,2),
ADD COLUMN     "rubro_evento_id" INTEGER;

-- CreateTable
CREATE TABLE "PagoParcialMovimiento" (
    "id" SERIAL NOT NULL,
    "movimiento_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "nota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PagoParcialMovimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoParcialMovimiento_movimiento_id_idx" ON "PagoParcialMovimiento"("movimiento_id");

-- CreateIndex
CREATE INDEX "Movimiento_rubro_evento_id_idx" ON "Movimiento"("rubro_evento_id");

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_rubro_evento_id_fkey" FOREIGN KEY ("rubro_evento_id") REFERENCES "RubroEvento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoParcialMovimiento" ADD CONSTRAINT "PagoParcialMovimiento_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "Movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

