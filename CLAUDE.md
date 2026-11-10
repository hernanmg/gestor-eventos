# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Qué es

ERP a medida para dos empresas del mismo grupo, en una sola plataforma:

- **Enjoy Producciones** (`empresa_id = 1`): producción de eventos.
- **DOS57** (`empresa_id = 2`): estructuras y rental (Layher, vallado), con flota y depósito propios.

Reemplaza las planillas de Excel y los grupos de WhatsApp con los que trabaja cada área. El sistema está construido y en preparación para la **primera prueba en producción** en Render (ver `docs/Preparacion_Prueba_Produccion.docx`).

## Estado del sistema: fuente única

**`docs/ESTADO_SISTEMA.md`** tiene el avance por pilar y por empresa, para el cliente. Reglas:

- **Al terminar una funcionalidad**, actualizar su fila (✅ / 🟡 / ⬜ / ❓) y recalcular el % del pilar y de la tabla resumen: ✅ cuenta 1, 🟡 cuenta 0,5, ⬜ y ❓ cuentan 0, "—" no aplica.
- **Si aparece un pedido nuevo** (relevamiento, planilla, reunión), agregarlo como fila ⬜ aunque no se haga todavía. La base del % es lo que se pidió, no lo que está hecho.
- **Cada funcionalidad cuenta en un solo pilar.** Los demás pilares la mencionan en "Se conecta con" o "No se cuentan acá".
- **El texto lo lee el cliente:** lenguaje de negocio, sin nombres de tablas ni de endpoints.
- **Cada mes** se toma una foto en `docs/avance/AAAA-MM.md`: copiar el modelo del mes anterior, comparar porcentajes y listar lo entregado (sale del `git log`).

### Los 12 pilares y dónde vive cada uno

| # | Pilar | Rutas del front (`frontend/src/pages`) | Backend (`backend/src/routes`) |
|---|---|---|---|
| 01 | RRHH | `RRHH` (empleados, jornadas, liquidaciones, sueldos admin), `Presentismo`, `ParteDiario`, `Uniformes` | `rrhh`, `presentismo`, `parteDiario`, `uniformes`, `excedenteHoras` |
| 02 | Finanzas | `Caja`, `GastosOperativos`, `TarjetaCorporativa`, `CuentasCorrientes`, `AFIPPrestamos`, `FacturasEmitidas`, `CierreContable` | `caja`, `cajaAndrea`, `echeqs`, `tarjetaCorporativa`, `cuentasCorrientes`, `afipPrestamos`, `sgr`, `facturasEmitidas`, `cierreContable`, `indicadores` |
| 03 | Administración | `Eventos`, `Evento` (ficha, egresos e ingresos, conciliatoria, centro de costos, costo real, cortesías), `PreMacro`, `Macro`, `Presupuestos`, `MaterialesRental`, `CostoReal`, `EspaciosCompartidos`, `Importer` | `eventos`, `movimientos`, `preMacro`, `macro`, `dashboard`, `fichaEvento`, `rubros`, `centroCostos`, `costoReal`, `presupuestos`, `cortesias`, `espaciosCompartidos`, `importer`, `exportar` |
| 04 | Proveedores | `Proveedores`, `Facturas`, `Evento/VincularProveedores` | `proveedores`, `facturas`, `importar` (formulario de Google) |
| 05 | Depósito | `Stock` (productos, cunas, camiones, pañol, activos, alertas, firmas) | `stock`, `panol`, `activos` |
| 06 | Logística | `Flota`, `Combustible`, `BitacoraViajes`, `MovimientoDiario`, `Evento` (logística, remitos, operación, producción, comidas) | `flota`, `combustible`, `movimientoDiario`, `remitos`, `operacion`, `produccionEvento`, `comidas` |
| 07 | Seguros | `Flota` (seguros), `Siniestros` | `flota`, `siniestros`, `siniestrosVehiculo` |
| 08 | Marketing | — (sin relevar, responsable Vicky) | — |
| 09 | Comunicación | — (sin relevar, responsable Vicky) | — |
| 10 | Novedades | — (no existe el libro de novedades) | — |
| 11 | Varios | `Configuracion`, `ConfiguracionEmpresa`, `Auditoria`, `Login`, `CambiarPassword`, `SeleccionarEmpresa` | `auth`, `usuarios`, `empresas`, `configuracion`, `auditoria`, `notificaciones` |
| 12 | Calendario | `Calendario`, `Macro` (para hoy / próximos días) | `calendario` |

Quién es quién en el cliente (Mayra, Andrea, Lorena, Jazmín, Flor, Male, Chino, Daniel, Vicky, Pollo…) está en la columna "Responsables" de cada pilar. Los relevamientos y las planillas reales están en `docs/dos57/<persona>/`, `docs/enjoy/` y `docs/especificaciones/`.

## Stack y comandos

- **Backend:** Node 20 + TypeScript + Express 4 + Prisma 5 (PostgreSQL), Zod, JWT en cookie httpOnly. Los PDF se generan con Puppeteer/Chromium.
- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui, TanStack Query, React Router.

```bash
docker compose up -d postgres         # base local (raíz del repo)
cd backend  && npm run dev            # nodemon + ts-node, puerto 3001 (sin watch fiable: reiniciar si no toma cambios)
cd frontend && npm run dev            # Vite, puerto 5173
cd backend  && npx tsc --noEmit       # chequeo de tipos del backend
cd frontend && npm run build          # tsc -b + vite build (chequeo de tipos del front)
cd backend  && npm run migrate:safe   # backup + prisma migrate dev
cd backend  && npm run seed           # empresas, rubros, usuarios, escalafones (no pisa datos)
```

No hay tests automatizados. La verificación se hace con `tsc`, el build y probando contra la base local.

**Scripts de trabajo:** todo script auxiliar o temporal va en `tools/` (ver `tools/README.md`), no en la raíz ni en carpetas del sistema. Lo de un solo uso va en `tools/tmp/`, que no se commitea. Los generadores de los informes mensuales para el cliente van en `tools/informes/`.

## Convenciones del código

- **Multi-empresa:** casi todo tiene `empresa_id`. Los controllers filtran con `withTenant(empresaId)` (`lib/tenant.ts`) y la empresa activa de la sesión. El admin global (`Usuario.empresa_id = null`, `puedeCambiarEmpresa`) ve las dos. Las vistas cross-empresa (Macro, Calendario, AFIP, SGR, cuentas de socios) resuelven el alcance en el controller, no en `tenantMiddleware`.
- **Roles:** `ADMIN`, `OPERADOR`, `VIEWER`, `JORNALERO`, `PAÑOLERO` (`middleware/requireRole.ts`). Además, `Usuario.permisos` da módulos puntuales a quien su rol no los da (tarjeta, facturas, padrón, uniformes, costo real).
- **Menú:** `frontend/src/components/layout/navConfig.ts` es la única fuente del Sidebar, la barra inferior del celular y los menús acotados por `Usuario.home_route`.
- **Soft delete** con `deleted_at` y `registrarAuditoria()` en toda escritura relevante. No se borran registros.
- **Debe/Haber:** en `Movimiento` (pestañas del evento), EGRESO va al DEBE e INGRESO al HABER. En las cajas (`MovimientoCaja`), el ingreso va al DEBE y el gasto al HABER.
- **Fechas:** los campos que son solo fecha de calendario se guardan a medianoche UTC y se leen en UTC. Los timestamps reales se leen en hora local. El servidor necesita `TZ=America/Argentina/Buenos_Aires`.
- **Importadores:** viven en `backend/src/lib/*Importer.ts`. Primero muestran una vista previa y después importan. Reimportar el mismo archivo no duplica: usan upsert con clave natural o un `import_key`. Siempre se parsea contra la planilla real de `docs/`, no contra la especificación.
- **Calendario:** un tipo nuevo hay que agregarlo en cuatro lugares: backend (`calendario.controller.ts`), `types/index.ts` (`TipoCalendario`), `hooks/useCalendario.ts` (`TIPO_QUERY_MAP`) y `lib/calendarioItems.ts` (rótulo y color). Hoy hay 4 tipos que el backend calcula y el front no muestra (ver Calendario, punto 14).
- **Tipos del front:** todos en `frontend/src/types/index.ts`, como espejo del schema.

## Cuidados (aprendidos a los golpes)

- **Nunca** usar `--shadow-database-url` apuntando a la base real: borró la base local el 2026-10-06. Para comparar el schema, usar `prisma migrate diff --from-schema-datasource`.
- `prisma migrate dev` falla en esta shell no interactiva. Escribir el SQL a mano en `prisma/migrations/<timestamp>_<nombre>/migration.sql`, siguiendo el estilo de las migraciones vecinas, y aplicar con `npx prisma migrate deploy`. En producción solo `migrate deploy`.
- En Windows, `prisma generate` da EPERM si el backend está corriendo: bajar nodemon primero. Los servers lanzados en background pueden quedar huérfanos en sus puertos; matarlos por puerto.
- En Bash, una `"\\"` dentro de un heredoc inline llega como `"\"`. Para scripts con barras invertidas, escribir el archivo con Write y correrlo.
- Los tests o scripts que escriben en la base van en una empresa temporal, con conteo antes y después. Nunca asumir que una empresa está vacía.
- Las planillas de `docs/` tienen datos personales y hasta claves fiscales. No copiarlas a código, seeds, commits ni documentos para el cliente.
- PDF en Render: el entorno Node de Render no trae Chromium, así que esos botones fallan allá hasta resolverlo.
