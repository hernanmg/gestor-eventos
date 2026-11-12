# Backend — Admin Portal Enjoy · DOS57

API REST en Node.js + Express + Prisma (PostgreSQL). Atiende a las dos empresas, con datos separados por `empresa_id`.

## Tech stack

| Capa       | Tecnología                                       |
|------------|--------------------------------------------------|
| Runtime    | Node.js 20 + TypeScript                          |
| Framework  | Express 4                                        |
| ORM        | Prisma 5 (PostgreSQL ≥ 14)                       |
| Auth       | JWT en cookie httpOnly (`token`)                 |
| Uploads    | Multer memoryStorage (PDF, Excel), archivos en la base |
| Excel      | `xlsx` / `exceljs` (importadores y exportadores) |
| PDF        | Puppeteer + Chromium (`lib/pdfExporter.ts`, `lib/pdfTemplates/`) |
| Validación | Zod                                              |
| Tests      | — (verificación con `tsc` y contra la base local)|

## Variables de entorno

Ver `.env.example`.

```
PORT=3001
NODE_ENV=development             # en production el seed genera contraseñas y no pisa datos
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=...
ADMIN_EMAIL=...                  # admin del sistema que crea el seed
ADMIN_PASSWORD=...
TZ=America/Argentina/Buenos_Aires  # obligatorio en servidores en UTC (parte diario, importadores, "hoy")
```

## Scripts

```bash
npm run dev            # nodemon + ts-node (src/server.ts)
npm run build          # tsc → dist/
npm start              # node dist/server.js
npm run migrate:safe   # backup + prisma migrate dev (usar esto, no migrate dev directo)
npm run backup         # sólo el backup
npm run seed           # empresas, pestañas, rubros, usuarios, escalafones, cajas (idempotente)
npm run build:render   # build + prisma migrate deploy (no corre el seed)
```

Para restaurar un backup: `psql $DATABASE_URL < backups/backup_<timestamp>.sql`.

### Migraciones: cuidado

- **Nunca** pasar `--shadow-database-url` apuntando a la base real: la vacía.
- `prisma migrate dev` no funciona en shells no interactivas. Escribir el SQL a mano en `prisma/migrations/<timestamp>_<nombre>/migration.sql` y aplicarlo con `npx prisma migrate deploy`.
- En producción, solo `prisma migrate deploy`.
- En Windows, bajar el server antes de `prisma generate`: si no, da EPERM.

## Estructura

```
src/
├── server.ts / app.ts      # arranque y registro de routers (/api/...)
├── routes/                 # un router por módulo: auth, roles, middlewares
├── controllers/            # lógica de cada endpoint
├── lib/                    # cálculo, importadores (*Importer.ts), exportadores (*Exporter.ts), tenant, auditoría
├── middleware/             # auth, tenant, requireRole, requireEventoAcceso, requireAdminGlobal, errorHandler
└── types/
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
scripts/                    # scripts puntuales (backup, correcciones de datos, cargas iniciales)
```

## Rutas por pilar

Todas bajo `/api`. El detalle de cada endpoint está en su archivo de `src/routes/`.

| Pilar | Prefijos |
|---|---|
| RRHH | `/rrhh` (empleados, jornadas, anticipos, liquidaciones, sueldos admin, escalafones, bitácora de viajes), `/presentismo`, `/parte-diario`, `/uniformes`, `/excedente-horas`, `/multas` |
| Finanzas | `/cuentas`, `/movimientos-caja`, `/caja` (caja del mes), `/echeqs`, `/tarjeta-corporativa`, `/cuentas-corrientes`, `/afip`, `/prestamos`, `/sgr`, `/facturas-emitidas`, `/cierre-contable`, `/indicadores` |
| Administración | `/eventos` (+ `/:id/ficha`, `/:id/centro-costos`, `/:id/costo-real`, `/:id/cortesias`, `/:id/stock`, exportar), `/movimientos`, `/pre-macro`, `/macro`, `/dashboard`, `/rubros`, `/rubros-evento`, `/pedido-items`, `/extras-evento`, `/costo-real`, `/presupuestos`, `/materiales-rental`, `/espacios-compartidos`, `/importer` |
| Proveedores | `/proveedores`, `/facturas`, `/pagos`, `/importar` (formulario de Google) |
| Depósito | `/stock`, `/panol`, `/activos` |
| Logística | `/flota`, `/combustible`, `/movimiento-diario`, `/remitos`, `/operacion`, `/eventos/:id/operacion`, `/produccion`, `/eventos/:id/produccion`, `/comidas`, `/eventos/:id/comidas` |
| Seguros | `/flota` (seguros), `/siniestros`, `/siniestros-vehiculos` |
| Varios | `/auth`, `/usuarios`, `/empresas`, `/empresa`, `/configuracion`, `/auditoria`, `/notificaciones` |
| Calendario | `/calendario` |

## Convenciones

- **Multi-empresa:** filtrar siempre por empresa con `withTenant(empresaId)`. Las vistas cross-empresa (Macro, Calendario, AFIP, SGR, cuentas de socios) resuelven el alcance en el controller.
- **Roles y permisos:** `requireRole` / `requireAnyRole(ROLES.X)`. Además, `Usuario.permisos` habilita módulos puntuales.
- `asyncHandler` envuelve todos los controllers, así los errores llegan al `errorHandler`.
- **Soft delete** con `deleted_at`; nunca se borran registros. `registrarAuditoria()` va en toda escritura relevante.
- **Debe/Haber:** en `Movimiento`, EGRESO va al DEBE e INGRESO al HABER. En `MovimientoCaja`, el ingreso va al DEBE y el gasto al HABER.
- **Fechas** que son solo de calendario: medianoche UTC, leídas en UTC.
- Los decimales de Prisma se convierten a `Number` antes de responder.
- **Importadores:** vista previa, después importación idempotente con upsert por clave natural o `import_key`.
- Las relaciones Prisma llevan nombre explícito cuando hay varias FK al mismo modelo (por ejemplo, `"PagoEcheq"`).

### Facturas a pagar (ejemplo de flujo completo)

- El PDF se guarda como `BYTEA` en la base.
- Al pagar con `tab_numero` se crea el `Movimiento` de egreso en el evento y se recalculan los saldos. Al pagar con `medio_pago=ECHEQ` se crea el `Echeq` ligado al pago.
- Anular un pago anula, en cadena, el movimiento y el echeq, y recalcula la factura. Si el echeq ya está COBRADO, devuelve `400`.
