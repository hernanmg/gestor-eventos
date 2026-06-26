# Frontend — Sistema de Gestión de Eventos

SPA en React 18 + Vite + TypeScript + TailwindCSS.

## Tech stack

| Capa           | Tecnología                              |
|----------------|-----------------------------------------|
| Framework      | React 18 + TypeScript                   |
| Build          | Vite 5                                  |
| Estilos        | Tailwind CSS v3 + shadcn/ui (Radix UI)  |
| Routing        | React Router v6                         |
| Data fetching  | TanStack Query v5                       |
| HTTP           | Axios (cookie `withCredentials: true`)  |
| Íconos         | lucide-react                            |
| Fechas         | date-fns                                |

## Prerequisitos

- Node.js ≥ 20
- Backend corriendo en `http://localhost:3001` (o según `VITE_API_URL`)

## Variables de entorno

```
VITE_API_URL=http://localhost:3001/api
```

## Instalación y dev

```bash
npm install
npm run dev    # Vite dev server en http://localhost:5173
```

## Build

```bash
npm run build   # dist/
npm run preview
```

## Estructura de carpetas

```
src/
├── App.tsx                  # Router raíz con todas las rutas
├── types/index.ts           # Todos los tipos TypeScript (espejo de Prisma)
├── lib/
│   ├── api.ts               # Instancia Axios con baseURL y withCredentials
│   ├── helpContent.ts       # Contenido contextual del HelpPanel por ruta
│   ├── formatters.ts        # formatCurrency, formatDate, etc.
│   └── utils.ts             # cn() y utilidades
├── hooks/
│   ├── useAuth.ts           # Autenticación (me, login, logout)
│   ├── useEvento.ts         # CRUD eventos + exportar
│   ├── useMovimientos.ts    # CRUD movimientos por tab
│   ├── useFacturas.ts       # CRUD facturas + pagos + alertas
│   ├── useEcheqs.ts         # CRUD echeqs + alertas
│   ├── useProveedores.ts    # CRUD proveedores
│   ├── useStock.ts          # Productos, asignaciones, alertas
│   ├── useVincularProveedores.ts  # Post-import wizard
│   ├── useTabConfig.ts      # Configuración de tabs
│   └── useAuditoria.ts      # Log de auditoría
├── components/
│   ├── layout/
│   │   ├── ProtectedLayout.tsx   # Layout con Sidebar + HelpPanel
│   │   └── Sidebar.tsx           # Navegación lateral con badges
│   ├── ui/
│   │   ├── HelpPanel.tsx         # Panel de ayuda contextual (slide-in, localStorage)
│   │   ├── button.tsx, badge.tsx, dialog.tsx, ...  # shadcn/ui
│   └── domain/
│       ├── MovimientoTable.tsx   # Tabla editable de movimientos
│       ├── EcheqFormDialog.tsx   # Formulario de echeq
│       └── ProveedorCombobox.tsx # Buscador de proveedores
└── pages/
    ├── Login/
    ├── Dashboard/
    ├── Eventos/              # Lista de eventos
    ├── Evento/               # Detalle con 8 tabs
    │   ├── index.tsx
    │   ├── Caja/
    │   ├── Conciliatoria/
    │   ├── Echeqs/
    │   ├── Stock/
    │   ├── Facturas/         # Tab facturas por evento
    │   └── VincularProveedores/  # Wizard post-import
    ├── Facturas/             # Lista global + detalle
    │   ├── index.tsx
    │   ├── FacturaForm.tsx
    │   └── FacturaDetalle.tsx
    ├── Proveedores/
    ├── Stock/
    ├── Importer/
    ├── Auditoria/
    └── Configuracion/
```

## Convenciones

- **Hooks**: un archivo por dominio (`useFacturas.ts`, `useEcheqs.ts`). Exportan queries + mutations.
- **QueryKeys**: arrays descriptivos `['facturas', id]`, `['facturas', 'alertas']`. Se invalidan por prefijo.
- **staleTime**: 30–60s en queries frecuentes, 5–10min en alertas/configuración.
- **FormData**: para uploads de archivo (PDF, Excel) — Axios detecta el tipo automáticamente cuando se pasan headers explícitos.
- **Soft delete**: nunca se eliminan datos. Los `deleted_at != null` no se muestran en la UI.
- **Moneda**: `formatCurrency(importe, moneda)` desde `@/lib/formatters`.
- **Tipos**: todos en `@/types/index.ts` como espejo del schema Prisma. Nunca definir tipos inline en componentes.

## Módulos principales

### HelpPanel
Panel de ayuda contextual que se monta **una sola vez** en `ProtectedLayout`. El contenido cambia según `useLocation().pathname`. El estado abierto/cerrado persiste en `localStorage`.

### Módulo de Facturas
- Lista global en `/facturas` con filtros por estado, moneda, vencimiento.
- Detalle en `/facturas/:id` con PDF viewer (iframe apuntando a `/api/facturas/:id/pdf`) y tabla de pagos.
- Formulario con drag-and-drop para PDF (10 MB máx, solo `application/pdf`).
- Tab en el evento (`/eventos/:id` → pestaña Facturas).
- Badge de alertas en Sidebar (vencidas + próximas a vencer en 7 días).
