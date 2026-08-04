-- CreateTable
CREATE TABLE "PreMacro" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "paso_actual" INTEGER NOT NULL DEFAULT 1,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "evento_id" INTEGER,
    "nombre_evento" TEXT,
    "tipo_evento" TEXT,
    "descripcion" TEXT,
    "para_que_es" TEXT,
    "es_privado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "hora_inicio" TEXT,
    "hora_fin" TEXT,
    "lugar_nombre" TEXT,
    "lugar_ciudad" TEXT,
    "lugar_provincia" TEXT,
    "lugar_direccion" TEXT,
    "dias_montaje" INTEGER,
    "dias_desmontaje" INTEGER,
    "cliente_nombre" TEXT,
    "razon_social" TEXT,
    "cuit_pagador" TEXT,
    "quien_lo_hace" TEXT,
    "contacto_cliente" TEXT,
    "telefono_cliente" TEXT,
    "presupuesto_total" DECIMAL(12,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "lleva_empleados" BOOLEAN NOT NULL DEFAULT true,
    "cantidad_estimada_staff" INTEGER,
    "requiere_hospedaje" BOOLEAN NOT NULL DEFAULT false,
    "ciudad_hospedaje" TEXT,
    "requiere_traslado" BOOLEAN NOT NULL DEFAULT false,
    "notas_traslado" TEXT,
    "requiere_comidas" BOOLEAN NOT NULL DEFAULT false,
    "cantidad_dias_comida" INTEGER,
    "observaciones_generales" TEXT,
    "rubros_sugeridos" JSONB,
    "rubros_confirmados" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER,

    CONSTRAINT "PreMacro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocioPreMacro" (
    "id" SERIAL NOT NULL,
    "pre_macro_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "SocioPreMacro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreMacro_evento_id_key" ON "PreMacro"("evento_id");

-- AddForeignKey
ALTER TABLE "PreMacro" ADD CONSTRAINT "PreMacro_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreMacro" ADD CONSTRAINT "PreMacro_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocioPreMacro" ADD CONSTRAINT "SocioPreMacro_pre_macro_id_fkey" FOREIGN KEY ("pre_macro_id") REFERENCES "PreMacro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
