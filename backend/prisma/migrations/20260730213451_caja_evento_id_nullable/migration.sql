-- AlterTable: evento_id ya no es obligatorio (cajas de empresa sin evento)
ALTER TABLE "CuentaBancaria" ALTER COLUMN "evento_id" DROP NOT NULL;

-- AlterTable: empresa_id nuevo, nullable primero para poder backfillear
ALTER TABLE "CuentaBancaria" ADD COLUMN "empresa_id" INTEGER;

-- Backfill: toda cuenta existente hereda la empresa de su evento actual
UPDATE "CuentaBancaria" c
SET "empresa_id" = e."empresa_id"
FROM "Evento" e
WHERE c."evento_id" = e."id";

-- AlterTable: ya con todas las filas backfilleadas, empresa_id pasa a obligatorio
ALTER TABLE "CuentaBancaria" ALTER COLUMN "empresa_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "CuentaBancaria" ADD CONSTRAINT "CuentaBancaria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
