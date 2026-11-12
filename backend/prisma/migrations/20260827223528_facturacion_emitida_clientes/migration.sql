-- CreateEnum
CREATE TYPE "TipoComprobanteEmitido" AS ENUM ('FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'FACTURA_MIPYMES_FCE_A', 'FACTURA_MIPYMES_FCE_B', 'NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C', 'NOTA_DEBITO_A', 'NOTA_DEBITO_B', 'RECIBO');

-- CreateEnum
CREATE TYPE "EstadoFacturaEmitida" AS ENUM ('EMITIDA', 'COBRADA_PARCIAL', 'COBRADA', 'INCOBRABLE', 'ANULADA');

-- CreateEnum
CREATE TYPE "CondicionCliente" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'EXENTO', 'CONSUMIDOR_FINAL', 'EXTERIOR');

-- CreateTable
CREATE TABLE "FacturaEmitida" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo_comprobante" "TipoComprobanteEmitido" NOT NULL,
    "punto_venta" INTEGER NOT NULL DEFAULT 1,
    "numero" TEXT,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "cliente_nombre" TEXT NOT NULL,
    "cliente_cuit" TEXT,
    "condicion_cliente" "CondicionCliente",
    "neto_gravado" DECIMAL(15,2),
    "iva" DECIMAL(15,2),
    "otros_impuestos" DECIMAL(15,2),
    "total" DECIMAL(15,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "tasa_cambio" DECIMAL(10,4),
    "total_ars" DECIMAL(15,2),
    "forma_pago" TEXT,
    "fecha_vencimiento" TIMESTAMP(3),
    "estado" "EstadoFacturaEmitida" NOT NULL DEFAULT 'EMITIDA',
    "evento_id" INTEGER,
    "concepto" TEXT,
    "observaciones" TEXT,
    "pdf_data" BYTEA,
    "pdf_nombre" TEXT,
    "pdf_mime_type" TEXT,
    "pdf_tamanio" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "FacturaEmitida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CobroFacturaEmitida" (
    "id" SERIAL NOT NULL,
    "factura_emitida_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "forma_cobro" TEXT,
    "cuenta_destino_id" INTEGER,
    "referencia" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "CobroFacturaEmitida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepartoFacturaEmitida" (
    "id" SERIAL NOT NULL,
    "factura_emitida_id" INTEGER NOT NULL,
    "razon_social" TEXT NOT NULL,
    "cuit" TEXT,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "empresa_id" INTEGER,

    CONSTRAINT "RepartoFacturaEmitida_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FacturaEmitida" ADD CONSTRAINT "FacturaEmitida_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaEmitida" ADD CONSTRAINT "FacturaEmitida_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobroFacturaEmitida" ADD CONSTRAINT "CobroFacturaEmitida_factura_emitida_id_fkey" FOREIGN KEY ("factura_emitida_id") REFERENCES "FacturaEmitida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobroFacturaEmitida" ADD CONSTRAINT "CobroFacturaEmitida_cuenta_destino_id_fkey" FOREIGN KEY ("cuenta_destino_id") REFERENCES "CuentaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepartoFacturaEmitida" ADD CONSTRAINT "RepartoFacturaEmitida_factura_emitida_id_fkey" FOREIGN KEY ("factura_emitida_id") REFERENCES "FacturaEmitida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepartoFacturaEmitida" ADD CONSTRAINT "RepartoFacturaEmitida_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
