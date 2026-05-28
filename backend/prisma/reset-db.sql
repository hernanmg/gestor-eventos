-- Limpia todos los datos dejando la estructura intacta.
-- No toca _prisma_migrations ni las tablas del sistema.
-- RESTART IDENTITY reinicia todas las secuencias de autoincremento.
-- CASCADE resuelve cualquier dependencia de FK sin importar el orden.

TRUNCATE TABLE
  "AuditoriaLog",
  "MovimientoStock",
  "AsignacionStock",
  "Echeq",
  "MovimientoCaja",
  "Movimiento",
  "CuentaBancaria",
  "Producto",
  "CategoriaStock",
  "Proveedor",
  "EventoAcceso",
  "Evento",
  "Usuario",
  "TabConfig"
RESTART IDENTITY CASCADE;

SELECT 'Base de datos limpia' AS status;
