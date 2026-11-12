-- CreateEnum
CREATE TYPE "CategoriaEmpleado" AS ENUM ('CAPITAN', 'ARMADOR', 'CHOFER', 'ADMINISTRATIVO', 'TECNICO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoEmpleado" AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "EstadoJornada" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('BORRADOR', 'APROBADA', 'PAGADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoAnticipo" AS ENUM ('ADELANTO', 'VALE', 'DESCUENTO');

-- CreateTable
CREATE TABLE "Empleado" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "cuit" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "domicilio" TEXT,
    "cbu" TEXT,
    "alias" TEXT,
    "banco" TEXT,
    "categoria" "CategoriaEmpleado" NOT NULL DEFAULT 'OTRO',
    "valor_hora" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_hora_extra" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado" "EstadoEmpleado" NOT NULL DEFAULT 'ACTIVO',
    "notas" TEXT,
    "usuario_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jornada" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "evento_id" INTEGER,
    "empresa_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora_convocatoria" TIMESTAMP(3),
    "hora_ingreso" TIMESTAMP(3),
    "hora_egreso" TIMESTAMP(3),
    "horas_normales" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "horas_extras" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "descripcion" TEXT,
    "estado" "EstadoJornada" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,
    "aprobado_por" INTEGER,
    "aprobado_at" TIMESTAMP(3),

    CONSTRAINT "Jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anticipo" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "tipo" "TipoAnticipo" NOT NULL DEFAULT 'ADELANTO',
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "descontado" BOOLEAN NOT NULL DEFAULT false,
    "liquidacion_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "Anticipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidacion" (
    "id" SERIAL NOT NULL,
    "empleado_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "evento_id" INTEGER,
    "fecha_desde" TIMESTAMP(3) NOT NULL,
    "fecha_hasta" TIMESTAMP(3) NOT NULL,
    "horas_normales" DECIMAL(8,2) NOT NULL,
    "horas_extras" DECIMAL(8,2) NOT NULL,
    "valor_hora" DECIMAL(10,2) NOT NULL,
    "valor_hora_extra" DECIMAL(10,2) NOT NULL,
    "subtotal_horas" DECIMAL(10,2) NOT NULL,
    "total_anticipos" DECIMAL(10,2) NOT NULL,
    "total_descuentos" DECIMAL(10,2) NOT NULL,
    "total_a_cobrar" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "movimiento_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "aprobado_por" INTEGER,
    "aprobado_at" TIMESTAMP(3),

    CONSTRAINT "Liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuario_id_key" ON "Empleado"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "Jornada_empleado_id_fecha_key" ON "Jornada"("empleado_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidacion_movimiento_id_key" ON "Liquidacion"("movimiento_id");

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jornada" ADD CONSTRAINT "Jornada_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anticipo" ADD CONSTRAINT "Anticipo_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "Liquidacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
