# Backend — Sistema de Gestión de Eventos

API REST en Node.js + Express + Prisma (PostgreSQL).

## Tech stack

| Capa       | Tecnología                              |
|------------|----------------------------------------|
| Runtime    | Node.js 20 + TypeScript                |
| Framework  | Express 4                              |
| ORM        | Prisma 5 (PostgreSQL)                  |
| Auth       | JWT en cookie httpOnly (`token`)       |
| Uploads    | Multer memoryStorage (PDF, Excel)      |
| Validación | Zod                                    |
| Tests      | —                                      |

## Prerequisitos

- Node.js ≥ 20
- PostgreSQL ≥ 14 accesible en `DATABASE_URL`

## Variables de entorno

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=tu_secreto
FRONTEND_URL=http://localhost:5173
PORT=3001
```

## Instalación

```bash
npm install
npx prisma migrate deploy   # aplica migraciones sobre la DB
npx prisma generate          # genera el cliente (ya incluido en postinstall)
```

## Desarrollo

```bash
npm run dev   # ts-node-dev con recarga en caliente
```

## Build producción

```bash
npm run build   # tsc → dist/
npm start       # node dist/index.js
```

## Estructura de rutas

| Prefijo                        | Descripción                              |
|-------------------------------|------------------------------------------|
| `POST /api/auth/login`        | Login — retorna cookie `token`           |
| `GET  /api/auth/me`           | Usuario autenticado                      |
| `GET  /api/eventos`           | Listado de eventos                       |
| `GET  /api/eventos/:id`       | Detalle de evento                        |
| `GET  /api/eventos/:id/movimientos` | Movimientos por tab              |
| `GET  /api/eventos/:id/movimientos/sin-proveedor` | Para wizard post-import |
| `POST /api/movimientos/vincular-proveedor` | Vinculación bulk         |
| `GET  /api/eventos/:id/facturas` | Facturas del evento                  |
| `POST /api/eventos/:id/facturas` | Crear factura (multipart/PDF)        |
| `GET  /api/facturas`          | Lista global con filtros                 |
| `GET  /api/facturas/alertas`  | Conteo vencidas + próximas a vencer      |
| `GET  /api/facturas/:id`      | Detalle de factura                       |
| `GET  /api/facturas/:id/pdf`  | Descarga binaria del PDF                 |
| `PUT  /api/facturas/:id`      | Editar factura                           |
| `PUT  /api/facturas/:id/pdf`  | Actualizar PDF                           |
| `DELETE /api/facturas/:id`    | Soft delete                              |
| `PATCH /api/facturas/:id/aprobar` | RECIBIDA → APROBADA                |
| `PATCH /api/facturas/:id/anular`  | → ANULADA                          |
| `POST /api/facturas/:id/pagos`    | Registrar pago (crea Movimiento/Echeq si aplica) |
| `DELETE /api/pagos/:id`       | Anular pago (soft delete encadenado)     |
| `GET  /api/proveedores`       | Listado de proveedores                   |
| `GET  /api/echeqs`            | Echeqs con filtros                       |
| `GET  /api/stock`             | Productos y disponibilidad               |
| `POST /api/importer/upload`   | Importar Excel                           |
| `GET  /api/dashboard`         | KPIs agregados                           |
| `GET  /api/auditoria`         | Log de auditoría paginado                |

## Módulos principales

### Facturas (Cuentas a Pagar)
- PDF almacenado como `BYTEA` en DB (nunca en disco).
- Al pagar con `tab_numero` configurado → crea `Movimiento` de egreso automáticamente y recalcula saldos.
- Al pagar con `medio_pago=ECHEQ` → crea `Echeq` vinculado al pago.
- Anular pago con echeq COBRADO → `400`.
- Soft delete en cascada: anular pago → anula movimiento → anula echeq → recalcula factura.

### Stock
- Disponibilidad calculada en tiempo real por fecha de evento.
- Alertas de quiebre actual y proyectado.
- Sugerencias de reutilización entre eventos.

### Importer
- Lee Excel con `xlsx` (10 hojas, formato Flujo de Caja Genérico).
- Post-import: wizard de vinculación de proveedores por concepto.

## Convenciones

- `asyncHandler` envuelve todos los controllers para propagar errores al `errorHandler`.
- Soft delete: campo `deleted_at`. Nunca se borran registros.
- `registrarAuditoria()` se llama en toda operación de escritura relevante.
- Decimales de Prisma se convierten a `Number` antes de responder.
- Relaciones Prisma con nombre explícito cuando hay múltiples FK al mismo modelo (ej. `"PagoMovimiento"`, `"PagoEcheq"`).
