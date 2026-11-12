-- CreateTable
CREATE TABLE "TarjetaCorporativa" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "banco" TEXT NOT NULL DEFAULT 'Galicia',
    "moneda_base" "Moneda" NOT NULL DEFAULT 'ARS',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarjetaCorporativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponsableTC" (
    "id" SERIAL NOT NULL,
    "tarjeta_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'PERSONAL',
    "usuario_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ResponsableTC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumoTC" (
    "id" SERIAL NOT NULL,
    "tarjeta_id" INTEGER NOT NULL,
    "responsable_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "periodo_mes" INTEGER NOT NULL,
    "periodo_anio" INTEGER NOT NULL,
    "monto_ars" DECIMAL(15,2),
    "monto_usd" DECIMAL(15,2),
    "detalle" TEXT,
    "observaciones" TEXT,
    "empresa_imputa" TEXT,
    "descontado" BOOLEAN NOT NULL DEFAULT false,
    "nota_descuento" TEXT,
    "import_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ConsumoTC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TarjetaCorporativa_empresa_id_nombre_key" ON "TarjetaCorporativa"("empresa_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ResponsableTC_tarjeta_id_nombre_tipo_key" ON "ResponsableTC"("tarjeta_id", "nombre", "tipo");

-- CreateIndex
CREATE INDEX "ConsumoTC_tarjeta_id_periodo_anio_periodo_mes_idx" ON "ConsumoTC"("tarjeta_id", "periodo_anio", "periodo_mes");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumoTC_tarjeta_id_import_key_key" ON "ConsumoTC"("tarjeta_id", "import_key");

-- AddForeignKey
ALTER TABLE "TarjetaCorporativa" ADD CONSTRAINT "TarjetaCorporativa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsableTC" ADD CONSTRAINT "ResponsableTC_tarjeta_id_fkey" FOREIGN KEY ("tarjeta_id") REFERENCES "TarjetaCorporativa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsableTC" ADD CONSTRAINT "ResponsableTC_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoTC" ADD CONSTRAINT "ConsumoTC_tarjeta_id_fkey" FOREIGN KEY ("tarjeta_id") REFERENCES "TarjetaCorporativa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoTC" ADD CONSTRAINT "ConsumoTC_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "ResponsableTC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
