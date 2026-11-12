-- CreateTable Empresa (primero — el resto de las tablas la referencian por FK)
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombre_corto" TEXT,
    "cuit" TEXT,
    "domicilio" TEXT,
    "logo_url" TEXT,
    "color_primario" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Empresa_cuit_key" ON "Empresa"("cuit");

-- Sembrar las dos empresas ya en la migración (no depender del orden con el seed)
INSERT INTO "Empresa" (id, nombre, nombre_corto, color_primario, activo, updated_at)
VALUES
  (1, 'Enjoy Producciones', 'Enjoy', '#1E3A5F', true, CURRENT_TIMESTAMP),
  (2, 'DOS57 Estructuras',  'DOS57', '#065F46', true, CURRENT_TIMESTAMP);

SELECT setval(pg_get_serial_sequence('"Empresa"', 'id'), (SELECT MAX(id) FROM "Empresa"));

-- CreateTable UsuarioEmpresaAcceso
CREATE TABLE "UsuarioEmpresaAcceso" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "UsuarioEmpresaAcceso_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsuarioEmpresaAcceso_usuario_id_empresa_id_key" ON "UsuarioEmpresaAcceso"("usuario_id", "empresa_id");

ALTER TABLE "UsuarioEmpresaAcceso" ADD CONSTRAINT "UsuarioEmpresaAcceso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsuarioEmpresaAcceso" ADD CONSTRAINT "UsuarioEmpresaAcceso_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Usuario.empresa_id: nullable — representa la empresa activa de la sesión.
-- Sin backfill: queda NULL para usuarios existentes (el admin actual pasa a ser
-- el admin global; los usuarios no-admin quedan sin empresa hasta correr el seed,
-- que los asigna vía UsuarioEmpresaAcceso).
ALTER TABLE "Usuario" ADD COLUMN "empresa_id" INTEGER;
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditoriaLog.empresa_id: nullable, sin backfill (auditoría histórica queda sin empresa)
ALTER TABLE "AuditoriaLog" ADD COLUMN "empresa_id" INTEGER;
ALTER TABLE "AuditoriaLog" ADD CONSTRAINT "AuditoriaLog_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- empresa_id requerido en 6 tablas: agregar nullable, backfill a Enjoy (1), forzar NOT NULL
ALTER TABLE "CategoriaStock" ADD COLUMN "empresa_id" INTEGER;
ALTER TABLE "Evento"         ADD COLUMN "empresa_id" INTEGER;
ALTER TABLE "Factura"        ADD COLUMN "empresa_id" INTEGER;
ALTER TABLE "Producto"       ADD COLUMN "empresa_id" INTEGER;
ALTER TABLE "Proveedor"      ADD COLUMN "empresa_id" INTEGER;
ALTER TABLE "TabConfig"      ADD COLUMN "empresa_id" INTEGER;

UPDATE "CategoriaStock" SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
UPDATE "Evento"         SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
UPDATE "Factura"        SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
UPDATE "Producto"       SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
UPDATE "Proveedor"      SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;
UPDATE "TabConfig"      SET "empresa_id" = 1 WHERE "empresa_id" IS NULL;

ALTER TABLE "CategoriaStock" ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Evento"         ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Factura"        ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Producto"       ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "Proveedor"      ALTER COLUMN "empresa_id" SET NOT NULL;
ALTER TABLE "TabConfig"      ALTER COLUMN "empresa_id" SET NOT NULL;

ALTER TABLE "CategoriaStock" ADD CONSTRAINT "CategoriaStock_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Evento"         ADD CONSTRAINT "Evento_empresa_id_fkey"         FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Factura"        ADD CONSTRAINT "Factura_empresa_id_fkey"        FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Producto"       ADD CONSTRAINT "Producto_empresa_id_fkey"       FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proveedor"      ADD CONSTRAINT "Proveedor_empresa_id_fkey"      FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TabConfig"      ADD CONSTRAINT "TabConfig_empresa_id_fkey"      FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reemplazar unicidad global por unicidad per-empresa
DROP INDEX "CategoriaStock_nombre_key";
DROP INDEX "Producto_codigo_key";
DROP INDEX "TabConfig_codigo_key";
DROP INDEX "TabConfig_tipo_numero_key";

CREATE UNIQUE INDEX "CategoriaStock_nombre_empresa_id_key" ON "CategoriaStock"("nombre", "empresa_id");
CREATE UNIQUE INDEX "Producto_codigo_empresa_id_key" ON "Producto"("codigo", "empresa_id");
CREATE UNIQUE INDEX "TabConfig_tipo_numero_empresa_id_key" ON "TabConfig"("tipo", "numero", "empresa_id");
CREATE UNIQUE INDEX "TabConfig_codigo_empresa_id_key" ON "TabConfig"("codigo", "empresa_id");
