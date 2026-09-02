-- CreateEnum
CREATE TYPE "CategoriaAcuerdo" AS ENUM ('GENERAL', 'CHOFER');

-- CreateEnum
CREATE TYPE "TipoAumento" AS ENUM ('MANUAL', 'IPC', 'SIN_AUMENTO');

-- AlterTable
ALTER TABLE "AcuerdoSueldo" ADD COLUMN     "categoria_acuerdo" "CategoriaAcuerdo" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "horas_pendientes_acum" DECIMAL(8,2),
ADD COLUMN     "porcentaje_acuerdo" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "LiquidacionAdmin" ADD COLUMN     "horas_pendientes_anterior" DECIMAL(8,2),
ADD COLUMN     "horas_pendientes_nuevo" DECIMAL(8,2),
ADD COLUMN     "ipc_mes_referencia" TEXT,
ADD COLUMN     "ipc_valor_aplicado" DECIMAL(5,2),
ADD COLUMN     "porcentaje_aumento_aplicado" DECIMAL(5,2),
ADD COLUMN     "tipo_aumento" "TipoAumento";
