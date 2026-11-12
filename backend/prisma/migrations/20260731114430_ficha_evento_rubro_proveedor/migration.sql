-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "telefono" TEXT;

-- CreateEnum
CREATE TYPE "EstadoRubroEvento" AS ENUM ('PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'NO_VA', 'CANCELADO');

-- CreateTable
CREATE TABLE "RubroEvento" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "rubro_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "proveedor_id" INTEGER,
    "estado" "EstadoRubroEvento" NOT NULL DEFAULT 'PENDIENTE',
    "contacto_nombre" TEXT,
    "contacto_telefono" TEXT,
    "contacto_cargo" TEXT,
    "coordina_nombre" TEXT,
    "fecha_ingreso" TIMESTAMP(3),
    "fecha_retiro" TIMESTAMP(3),
    "presupuesto" DECIMAL(12,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "RubroEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" SERIAL NOT NULL,
    "rubro_evento_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,2),
    "unidad" TEXT,
    "descripcion" TEXT NOT NULL,
    "dias_uso" INTEGER,
    "horario_llegada" TEXT,
    "horario_retiro" TEXT,
    "observaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RubroEvento_evento_id_rubro_id_key" ON "RubroEvento"("evento_id", "rubro_id");

-- AddForeignKey
ALTER TABLE "RubroEvento" ADD CONSTRAINT "RubroEvento_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubroEvento" ADD CONSTRAINT "RubroEvento_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "Rubro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubroEvento" ADD CONSTRAINT "RubroEvento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubroEvento" ADD CONSTRAINT "RubroEvento_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_rubro_evento_id_fkey" FOREIGN KEY ("rubro_evento_id") REFERENCES "RubroEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
