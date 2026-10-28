-- CreateTable
CREATE TABLE "CronogramaEvento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT,
    "actividad" TEXT NOT NULL,
    "proveedor" TEXT,
    "responsable" TEXT,
    "observaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "CronogramaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EspacioEvento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "numero" INTEGER,
    "nombre" TEXT NOT NULL,
    "actividad" TEXT,
    "observaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "EspacioEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EspacioEventoItem" (
    "id" SERIAL NOT NULL,
    "espacio_id" INTEGER NOT NULL,
    "elemento" TEXT NOT NULL,
    "estado" TEXT,
    "responsable" TEXT,
    "observaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "EspacioEventoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuntoInternetEvento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "numero" INTEGER,
    "zona" TEXT NOT NULL,
    "uso" TEXT,
    "tipo_conexion" TEXT,
    "observaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PuntoInternetEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandingEvento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT,
    "cantidad" DECIMAL(10,2),
    "ubicacion" TEXT,
    "estado" TEXT,
    "observaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "BrandingEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraEvento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "numero" INTEGER,
    "fecha" TIMESTAMP(3),
    "pedido" TEXT NOT NULL,
    "cantidad" DECIMAL(10,2),
    "valor" DECIMAL(14,2),
    "proveedor" TEXT,
    "forma_pago" TEXT,
    "solicita" TEXT,
    "autoriza" TEXT,
    "observaciones" TEXT,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "CompraEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronogramaEvento_evento_id_fecha_idx" ON "CronogramaEvento"("evento_id", "fecha");

-- CreateIndex
CREATE INDEX "EspacioEvento_evento_id_idx" ON "EspacioEvento"("evento_id");

-- CreateIndex
CREATE INDEX "EspacioEventoItem_espacio_id_idx" ON "EspacioEventoItem"("espacio_id");

-- CreateIndex
CREATE INDEX "PuntoInternetEvento_evento_id_idx" ON "PuntoInternetEvento"("evento_id");

-- CreateIndex
CREATE INDEX "BrandingEvento_evento_id_idx" ON "BrandingEvento"("evento_id");

-- CreateIndex
CREATE INDEX "CompraEvento_evento_id_idx" ON "CompraEvento"("evento_id");

-- AddForeignKey
ALTER TABLE "CronogramaEvento" ADD CONSTRAINT "CronogramaEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronogramaEvento" ADD CONSTRAINT "CronogramaEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EspacioEvento" ADD CONSTRAINT "EspacioEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EspacioEvento" ADD CONSTRAINT "EspacioEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EspacioEventoItem" ADD CONSTRAINT "EspacioEventoItem_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "EspacioEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoInternetEvento" ADD CONSTRAINT "PuntoInternetEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoInternetEvento" ADD CONSTRAINT "PuntoInternetEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandingEvento" ADD CONSTRAINT "BrandingEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandingEvento" ADD CONSTRAINT "BrandingEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraEvento" ADD CONSTRAINT "CompraEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraEvento" ADD CONSTRAINT "CompraEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

