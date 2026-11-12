-- CreateEnum
CREATE TYPE "MonedaCCC" AS ENUM ('ARS', 'USD', 'EUR');

-- Migrate CuentaCorriente/MovimientoCCC off the old "Moneda" enum BEFORE it's
-- dropped below — both tables were created against "Moneda" by the previous
-- migration (cuenta_corriente_generica), back when EUR was added to the
-- shared enum instead of to its own MonedaCCC.
ALTER TABLE "CuentaCorriente" DROP COLUMN "moneda",
ADD COLUMN     "moneda" "MonedaCCC" NOT NULL DEFAULT 'ARS';

ALTER TABLE "MovimientoCCC" DROP COLUMN "moneda",
ADD COLUMN     "moneda" "MonedaCCC" NOT NULL;

-- AlterEnum
BEGIN;
CREATE TYPE "Moneda_new" AS ENUM ('ARS', 'USD');
ALTER TABLE "CuentaBancaria" ALTER COLUMN "moneda" DROP DEFAULT;
ALTER TABLE "Echeq" ALTER COLUMN "moneda" DROP DEFAULT;
ALTER TABLE "Empresa" ALTER COLUMN "moneda_default" DROP DEFAULT;
ALTER TABLE "Evento" ALTER COLUMN "moneda_base" DROP DEFAULT;
ALTER TABLE "Factura" ALTER COLUMN "moneda" DROP DEFAULT;
ALTER TABLE "Movimiento" ALTER COLUMN "moneda" DROP DEFAULT;
ALTER TABLE "PagoFactura" ALTER COLUMN "moneda" DROP DEFAULT;
ALTER TABLE "PreMacro" ALTER COLUMN "moneda" DROP DEFAULT;
ALTER TABLE "RubroEvento" ALTER COLUMN "moneda" DROP DEFAULT;
ALTER TABLE "Empresa" ALTER COLUMN "moneda_default" TYPE "Moneda_new" USING ("moneda_default"::text::"Moneda_new");
ALTER TABLE "Evento" ALTER COLUMN "moneda_base" TYPE "Moneda_new" USING ("moneda_base"::text::"Moneda_new");
ALTER TABLE "RubroEvento" ALTER COLUMN "moneda" TYPE "Moneda_new" USING ("moneda"::text::"Moneda_new");
ALTER TABLE "Movimiento" ALTER COLUMN "moneda" TYPE "Moneda_new" USING ("moneda"::text::"Moneda_new");
ALTER TABLE "CuentaBancaria" ALTER COLUMN "moneda" TYPE "Moneda_new" USING ("moneda"::text::"Moneda_new");
ALTER TABLE "Echeq" ALTER COLUMN "moneda" TYPE "Moneda_new" USING ("moneda"::text::"Moneda_new");
ALTER TABLE "Factura" ALTER COLUMN "moneda" TYPE "Moneda_new" USING ("moneda"::text::"Moneda_new");
ALTER TABLE "PagoFactura" ALTER COLUMN "moneda" TYPE "Moneda_new" USING ("moneda"::text::"Moneda_new");
ALTER TABLE "PreMacro" ALTER COLUMN "moneda" TYPE "Moneda_new" USING ("moneda"::text::"Moneda_new");
ALTER TYPE "Moneda" RENAME TO "Moneda_old";
ALTER TYPE "Moneda_new" RENAME TO "Moneda";
DROP TYPE "Moneda_old";
ALTER TABLE "CuentaBancaria" ALTER COLUMN "moneda" SET DEFAULT 'ARS';
ALTER TABLE "Echeq" ALTER COLUMN "moneda" SET DEFAULT 'ARS';
ALTER TABLE "Empresa" ALTER COLUMN "moneda_default" SET DEFAULT 'ARS';
ALTER TABLE "Evento" ALTER COLUMN "moneda_base" SET DEFAULT 'ARS';
ALTER TABLE "Factura" ALTER COLUMN "moneda" SET DEFAULT 'ARS';
ALTER TABLE "Movimiento" ALTER COLUMN "moneda" SET DEFAULT 'ARS';
ALTER TABLE "PagoFactura" ALTER COLUMN "moneda" SET DEFAULT 'ARS';
ALTER TABLE "PreMacro" ALTER COLUMN "moneda" SET DEFAULT 'ARS';
ALTER TABLE "RubroEvento" ALTER COLUMN "moneda" SET DEFAULT 'ARS';
COMMIT;
