-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('ABIERTA', 'PENDIENTE_RENDICION', 'CERRADA');

-- AlterTable
ALTER TABLE "CuentaBancaria" ADD COLUMN     "estado" "EstadoCuenta" NOT NULL DEFAULT 'ABIERTA',
ADD COLUMN     "fecha_apertura" TIMESTAMP(3),
ADD COLUMN     "fecha_cierre" TIMESTAMP(3),
ADD COLUMN     "notas_rendicion" TEXT,
ADD COLUMN     "responsable_id" INTEGER,
ADD COLUMN     "saldo_minimo" DECIMAL(12,2);

-- AddForeignKey
ALTER TABLE "CuentaBancaria" ADD CONSTRAINT "CuentaBancaria_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
