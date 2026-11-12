-- AlterTable
ALTER TABLE "LiquidacionAdmin" ADD COLUMN     "prestamos_descontados" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EscalafonAdmin" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "viatico" DECIMAL(12,2),
    "premio_presentismo" DECIMAL(12,2),
    "telefono" DECIMAL(12,2),
    "premio_incentivo" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "EscalafonAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrestamoEmpleado" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "detalle" TEXT NOT NULL,
    "monto_total" DECIMAL(12,2) NOT NULL,
    "cantidad_cuotas" INTEGER NOT NULL DEFAULT 1,
    "cuotas_pagadas" INTEGER NOT NULL DEFAULT 0,
    "monto_cuota" DECIMAL(12,2) NOT NULL,
    "saldado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PrestamoEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoPrestamoEmpleado" (
    "id" SERIAL NOT NULL,
    "prestamo_id" INTEGER NOT NULL,
    "liquidacion_admin_id" INTEGER,
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoPrestamoEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscalafonAdmin_empresa_id_nombre_key" ON "EscalafonAdmin"("empresa_id", "nombre");

-- AddForeignKey
ALTER TABLE "EscalafonAdmin" ADD CONSTRAINT "EscalafonAdmin_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrestamoEmpleado" ADD CONSTRAINT "PrestamoEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrestamoEmpleado" ADD CONSTRAINT "PrestamoEmpleado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoPrestamoEmpleado" ADD CONSTRAINT "PagoPrestamoEmpleado_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "PrestamoEmpleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoPrestamoEmpleado" ADD CONSTRAINT "PagoPrestamoEmpleado_liquidacion_admin_id_fkey" FOREIGN KEY ("liquidacion_admin_id") REFERENCES "LiquidacionAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

