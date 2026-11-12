-- CreateTable
CREATE TABLE "EventoCuenta" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "cuenta_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "EventoCuenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventoCuenta_evento_id_cuenta_id_key" ON "EventoCuenta"("evento_id", "cuenta_id");

-- AddForeignKey
ALTER TABLE "EventoCuenta" ADD CONSTRAINT "EventoCuenta_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoCuenta" ADD CONSTRAINT "EventoCuenta_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "CuentaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
