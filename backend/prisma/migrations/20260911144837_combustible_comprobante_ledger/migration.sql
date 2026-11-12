-- AlterTable
ALTER TABLE "CargaCombustible" ADD COLUMN     "numero_comprobante" TEXT,
ADD COLUMN     "pagos" DECIMAL(12,2),
ADD COLUMN     "saldo" DECIMAL(15,2),
ADD COLUMN     "tipo_movimiento" TEXT,
ALTER COLUMN "litros" SET DATA TYPE DECIMAL(10,3);

-- CreateIndex
CREATE INDEX "CargaCombustible_empresa_id_numero_comprobante_idx" ON "CargaCombustible"("empresa_id", "numero_comprobante");
