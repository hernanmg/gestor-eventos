# Frontend — Admin Portal Enjoy · DOS57

SPA en React 18 + Vite + TypeScript + Tailwind. Sirve a las dos empresas: el usuario elige la empresa (o el admin global ve las dos) y el menú se arma según su rol, sus permisos y su pantalla de inicio.

## Tech stack

| Capa           | Tecnología                              |
|----------------|-----------------------------------------|
| Framework      | React 18 + TypeScript                   |
| Build          | Vite 5                                  |
| Estilos        | Tailwind CSS v3 + shadcn/ui (Radix UI), tema claro/oscuro |
| Routing        | React Router v6                         |
| Data fetching  | TanStack Query v5                       |
| HTTP           | Axios (cookie `withCredentials: true`)  |
| Gráficos       | Recharts                                |
| Íconos / fechas| lucide-react / date-fns                 |

## Variables de entorno

```
VITE_API_URL=http://localhost:3001   # sin /api: lib/api.ts lo agrega solo
```

## Scripts

```bash
npm run dev       # http://localhost:5173
npm run build     # tsc -b + vite build → dist/ (es también el chequeo de tipos)
npm run preview
```

En producción como sitio estático, hace falta la regla de reescritura `/* → /index.html`. Sin ella, refrescar una ruta como `/presentismo` da 404.

## Estructura

```
src/
├── App.tsx                    # rutas
├── types/index.ts             # todos los tipos (espejo del schema Prisma)
├── lib/                       # api, formatters, permisos, features, helpContent, calendarioItems, empresasConstants
├── hooks/                     # un archivo por dominio (useRRHH, useFacturas, useFlota, useCalendario…)
├── components/
│   ├── layout/                # navConfig (fuente única del menú), Sidebar, MobileNav, NotificacionesBell, ProtectedLayout
│   ├── ui/                    # shadcn/ui + BaseTable, MoneyInput, CuitInput, combobox, HelpPanel
│   └── domain/ flota/ siniestros/ uniformes/ indicadores/
└── pages/                     # una carpeta por pantalla
```

## Pantallas por pilar

| Pilar | Carpetas de `pages/` |
|---|---|
| RRHH | `RRHH`, `Presentismo`, `ParteDiario`, `Uniformes` |
| Finanzas | `Caja`, `GastosOperativos`, `TarjetaCorporativa`, `CuentasCorrientes`, `AFIPPrestamos`, `FacturasEmitidas`, `CierreContable` |
| Administración | `Eventos`, `Evento` (pestañas: resumen, operación, ficha, producción, centro de costos, costo real, egresos, ingresos, caja, conciliatoria, echeqs, stock, comidas, cortesías, logística, facturas, a cobrar, auditoría), `PreMacro`, `Macro`, `Presupuestos`, `MaterialesRental`, `CostoReal`, `EspaciosCompartidos`, `Importer` |
| Proveedores | `Proveedores`, `Facturas`, `Evento/VincularProveedores` |
| Depósito | `Stock` (productos, cunas, camiones, pañol, activos, alertas, firmar movimiento) |
| Logística | `Flota`, `Combustible`, `BitacoraViajes`, `MovimientoDiario` |
| Seguros | `Flota` (seguros), `Siniestros` |
| Varios | `Login`, `CambiarPassword`, `SeleccionarEmpresa`, `Configuracion`, `ConfiguracionEmpresa`, `Auditoria` |
| Calendario | `Calendario` |

## Convenciones

- **Menú:** `components/layout/navConfig.ts` es la única fuente para el Sidebar, la barra inferior del celular y los menús acotados por `home_route`. Una pantalla nueva se agrega ahí, con su grupo y su condición de visibilidad.
- **Hooks:** un archivo por dominio, que exporta queries y mutations. Los queryKeys son arrays descriptivos (`['facturas', id]`) y se invalidan por prefijo.
- **Tipos:** en `@/types/index.ts`; no definir tipos inline en los componentes.
- **Calendario:** un tipo nuevo va en `TipoCalendario` (`types`), en `TIPO_QUERY_MAP` (`hooks/useCalendario.ts`) y en rótulo y color (`lib/calendarioItems.ts`), además del backend.
- **Montos y CUIT:** usar `MoneyInput` / `CuitInput` y `formatCurrency(importe, moneda)`.
- **Tablas:** `BaseTable` con estilo de card; en el celular las filas se apilan por `data-label`.
- **Fechas** que son solo de calendario: se leen en UTC, porque si no se corren un día.
- **Soft delete:** lo que tiene `deleted_at` no se muestra.
- **Ayuda:** `lib/helpContent.ts`, contenido por ruta, con buscador y links a otras pantallas.
