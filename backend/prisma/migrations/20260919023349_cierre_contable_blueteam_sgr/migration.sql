-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "es_comisionista" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "porcentaje_comision" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "SGR" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado_vinculacion" TEXT NOT NULL DEFAULT 'ACTIVO',
    "fecha_vinculacion" TIMESTAMP(3),
    "fecha_vencimiento" TIMESTAMP(3),
    "cupo_total" DECIMAL(15,2),
    "cupo_utilizado" DECIMAL(15,2),
    "cupo_disponible" DECIMAL(15,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "contacto_nombre" TEXT,
    "contacto_tel" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "SGR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreContable" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha_corte" TIMESTAMP(3) NOT NULL,
    "periodo_anio" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "snapshot" JSONB NOT NULL,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "CierreContable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CierreContable_empresa_id_fecha_corte_key" ON "CierreContable"("empresa_id", "fecha_corte");

-- AddForeignKey
ALTER TABLE "SGR" ADD CONSTRAINT "SGR_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreContable" ADD CONSTRAINT "CierreContable_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
