-- CreateEnum
CREATE TYPE "TipoTercero" AS ENUM ('PROVEEDOR', 'CLIENTE', 'SOCIO', 'CLUB', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMovCCC" AS ENUM ('DEBE', 'HABER', 'AJUSTE');

-- AlterEnum
ALTER TYPE "Moneda" ADD VALUE 'EUR';

-- CreateTable
CREATE TABLE "CuentaCorriente" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo_tercero" "TipoTercero" NOT NULL,
    "proveedor_id" INTEGER,
    "tercero_nombre" TEXT,
    "tercero_cuit" TEXT,
    "nombre" TEXT NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "saldo_actual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tiene_reparto" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "CuentaCorriente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParteCCC" (
    "id" SERIAL NOT NULL,
    "cuenta_ccc_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "ParteCCC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCCC" (
    "id" SERIAL NOT NULL,
    "cuenta_ccc_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" "TipoMovCCC" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "concepto" TEXT NOT NULL,
    "descripcion" TEXT,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "tasa_cambio" DECIMAL(10,4),
    "monto_ars" DECIMAL(15,2),
    "saldo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "factura_id" INTEGER,
    "evento_id" INTEGER,
    "documento_data" BYTEA,
    "documento_nombre" TEXT,
    "documento_mime" TEXT,
    "documento_tamanio" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "MovimientoCCC_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CuentaCorriente" ADD CONSTRAINT "CuentaCorriente_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCorriente" ADD CONSTRAINT "CuentaCorriente_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParteCCC" ADD CONSTRAINT "ParteCCC_cuenta_ccc_id_fkey" FOREIGN KEY ("cuenta_ccc_id") REFERENCES "CuentaCorriente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCCC" ADD CONSTRAINT "MovimientoCCC_cuenta_ccc_id_fkey" FOREIGN KEY ("cuenta_ccc_id") REFERENCES "CuentaCorriente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCCC" ADD CONSTRAINT "MovimientoCCC_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCCC" ADD CONSTRAINT "MovimientoCCC_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCCC" ADD CONSTRAINT "MovimientoCCC_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
