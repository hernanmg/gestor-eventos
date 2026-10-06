-- CreateEnum
CREATE TYPE "TipoIndicador" AS ENUM ('DOLAR_OFICIAL', 'DOLAR_BLUE', 'IPC');

-- CreateTable
CREATE TABLE "IndicadorEconomico" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoIndicador" NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,
    "compra" DECIMAL(12,2),
    "venta" DECIMAL(12,2),
    "periodo" TEXT,
    "fuente_fecha" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicadorEconomico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndicadorEconomico_tipo_created_at_idx" ON "IndicadorEconomico"("tipo", "created_at");

