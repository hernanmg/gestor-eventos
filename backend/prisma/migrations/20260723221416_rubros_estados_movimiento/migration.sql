-- CreateEnum
CREATE TYPE "TipoRubro" AS ENUM ('EGRESO', 'INGRESO');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('PENDIENTE', 'COTIZANDO', 'CONFIRMADO', 'PAGADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN     "avisado_proveedor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "costo_real" DECIMAL(15,2),
ADD COLUMN     "estado_movimiento" "EstadoMovimiento" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "fecha_pago" TIMESTAMP(3),
ADD COLUMN     "presupuesto" DECIMAL(15,2),
ADD COLUMN     "responsable_id" INTEGER,
ADD COLUMN     "rubro_id" INTEGER,
ALTER COLUMN "tab_numero" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Rubro" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" "TipoRubro" NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "Rubro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rubro_empresa_id_tipo_nombre_key" ON "Rubro"("empresa_id", "tipo", "nombre");

-- AddForeignKey
ALTER TABLE "Rubro" ADD CONSTRAINT "Rubro_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "Rubro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
