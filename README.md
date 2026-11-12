# Admin Portal — Enjoy · DOS57

Sistema de gestión integral para **Enjoy Producciones** y **DOS57**: una sola plataforma para las dos empresas, con información por roles y permisos, accesible desde cualquier dispositivo. Reemplaza las planillas de Excel y los mensajes informales con los que trabaja hoy cada área.

## Estado

El avance detallado, por pilar y por empresa, está en **[docs/ESTADO_SISTEMA.md](docs/ESTADO_SISTEMA.md)**. Cada mes se agrega un informe en [docs/avance/](docs/avance/).

| # | Pilar | DOS57 | Enjoy |
|---|---|---|---|
| 01 | RRHH | 87% | 83% |
| 02 | Finanzas | 72% | 74% |
| 03 | Administración | 87% | 82% |
| 04 | Proveedores | 73% | 71% |
| 05 | Depósito | 78% | 82% |
| 06 | Logística | 86% | 86% |
| 07 | Seguros | 61% | 50% |
| 08 | Marketing | sin relevar | sin relevar |
| 09 | Comunicación | sin relevar | sin relevar |
| 10 | Novedades | 17% | 17% |
| 11 | Varios y módulos auxiliares | 90% | 90% |
| 12 | Calendario transversal | 80% | 80% |

Los porcentajes son de lo **construido** sobre lo pedido en los relevamientos, a noviembre de 2026. El uso real arranca con la primera prueba en producción.

## Estructura del repositorio

```
backend/    API REST — Node 20, Express, Prisma, PostgreSQL   → backend/README.md
frontend/   SPA — React 18, Vite, Tailwind, shadcn/ui         → frontend/README.md
deploy/     Instalación on-premise (Nginx, PM2, Certbot)      → deploy/README-deploy.md
docs/       Kick-off, relevamientos, planillas reales de cada área, estado y avance
```

## Levantarlo en local

```bash
docker compose up -d postgres        # PostgreSQL 16 (necesita POSTGRES_PASSWORD en .env)

cd backend
cp .env.example .env                 # completar DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npx prisma migrate deploy
npm run seed
npm run dev                          # http://localhost:3001

cd ../frontend
cp .env.example .env                 # VITE_API_URL=http://localhost:3001
npm install
npm run dev                          # http://localhost:5173
```

## Documentos

| Documento | Qué tiene |
|---|---|
| `docs/KickOff-Enjoy-DOS57.pptx` | Presentación inicial y los pilares |
| `docs/ESTADO_SISTEMA.md` | Avance por pilar y lo que falta definir con el cliente |
| `docs/avance/` | Informes mensuales |
| `docs/Preparacion_Prueba_Produccion.docx` | Plan de la primera prueba en producción (Render), por persona |
| `docs/dos57/<persona>/`, `docs/enjoy/` | Relevamientos y planillas reales de cada área |
| `docs/especificaciones/` | Especificación funcional de Enjoy, modelo de datos, roadmap |
