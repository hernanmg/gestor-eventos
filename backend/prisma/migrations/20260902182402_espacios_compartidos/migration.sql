-- CreateEnum
CREATE TYPE "EstadoLineaGasto" AS ENUM ('PENDIENTE', 'PAGADO', 'ANULADO');

-- CreateTable
CREATE TABLE "EspacioCompartido" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "dia_generacion" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "EspacioCompartido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParteEspacio" (
    "id" SERIAL NOT NULL,
    "espacio_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "empresa_id" INTEGER,
    "cuenta_corriente_id" INTEGER,

    CONSTRAINT "ParteEspacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoTipoEspacio" (
    "id" SERIAL NOT NULL,
    "espacio_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto_estimado" DECIMAL(12,2) NOT NULL,
    "dia_vencimiento" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_fijo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoTipoEspacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoMesEspacio" (
    "id" SERIAL NOT NULL,
    "espacio_id" INTEGER NOT NULL,
    "periodo_mes" INTEGER NOT NULL,
    "periodo_anio" INTEGER NOT NULL,
    "generado_auto" BOOLEAN NOT NULL DEFAULT false,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "total_gastos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GastoMesEspacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaGastoEspacio" (
    "id" SERIAL NOT NULL,
    "gasto_mes_id" INTEGER NOT NULL,
    "gasto_tipo_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "monto_real" DECIMAL(12,2) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3),
    "estado" "EstadoLineaGasto" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_pago" TIMESTAMP(3),
    "comprobante_data" BYTEA,
    "comprobante_nombre" TEXT,
    "comprobante_mime" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "LineaGastoEspacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepartoLineaGasto" (
    "id" SERIAL NOT NULL,
    "linea_id" INTEGER NOT NULL,
    "parte_id" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "movimiento_ccc_id" INTEGER,

    CONSTRAINT "RepartoLineaGasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParteEspacio_espacio_id_nombre_key" ON "ParteEspacio"("espacio_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "GastoMesEspacio_espacio_id_periodo_mes_periodo_anio_key" ON "GastoMesEspacio"("espacio_id", "periodo_mes", "periodo_anio");

-- AddForeignKey
ALTER TABLE "EspacioCompartido" ADD CONSTRAINT "EspacioCompartido_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParteEspacio" ADD CONSTRAINT "ParteEspacio_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "EspacioCompartido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParteEspacio" ADD CONSTRAINT "ParteEspacio_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParteEspacio" ADD CONSTRAINT "ParteEspacio_cuenta_corriente_id_fkey" FOREIGN KEY ("cuenta_corriente_id") REFERENCES "CuentaCorriente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoTipoEspacio" ADD CONSTRAINT "GastoTipoEspacio_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "EspacioCompartido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoMesEspacio" ADD CONSTRAINT "GastoMesEspacio_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "EspacioCompartido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaGastoEspacio" ADD CONSTRAINT "LineaGastoEspacio_gasto_mes_id_fkey" FOREIGN KEY ("gasto_mes_id") REFERENCES "GastoMesEspacio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaGastoEspacio" ADD CONSTRAINT "LineaGastoEspacio_gasto_tipo_id_fkey" FOREIGN KEY ("gasto_tipo_id") REFERENCES "GastoTipoEspacio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepartoLineaGasto" ADD CONSTRAINT "RepartoLineaGasto_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "LineaGastoEspacio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepartoLineaGasto" ADD CONSTRAINT "RepartoLineaGasto_parte_id_fkey" FOREIGN KEY ("parte_id") REFERENCES "ParteEspacio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepartoLineaGasto" ADD CONSTRAINT "RepartoLineaGasto_movimiento_ccc_id_fkey" FOREIGN KEY ("movimiento_ccc_id") REFERENCES "MovimientoCCC"("id") ON DELETE SET NULL ON UPDATE CASCADE;
