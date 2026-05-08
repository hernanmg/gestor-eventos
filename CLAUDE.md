# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This repo is in the **planning phase** of a financial management web system for an events company. The client currently uses an Excel template (`docs/Flujo de Caja Generico.xlsx`) to track finances per event.

The `frontend/` and `backend/` directories are currently empty — the application has not been built yet.

## Current working script

`plan_desarrollo.js` generates the development proposal document (`Plan_Desarrollo_Sistema_Eventos.docx`) using the `docx` npm package.

```
node plan_desarrollo.js
```

Output: `Plan_Desarrollo_Sistema_Eventos.docx` in the project root.

## System being built (planned)

A Node.js web app that replaces the Excel workflow. Key constraints derived from the client's Excel template:

**Expense categories (5 fixed tabs):**
- `EG-TC` — general event costs
- `EG-SOC` — partner/shareholder expenses
- `EG-EXTRA` — extraordinary expenses + echeqs (electronic checks) sub-table
- `EG-IMP` — taxes with fixed subcategories: PAYWAY, REBA, AUTOENTRADA, IVA, IIBB, Municipalidad, Ganancias
- `EG-PREST` — loans

**Income categories (5 fixed tabs):**
- Tickets, Sponsors, Corporativo, Gastronomía, Service Charge

**Each movement row:** fecha, concepto, descripción, debe, haber, saldo acumulado

**Caja module:** saldo inicial + running balance per row, supports 2-3 bank accounts

**Conciliatoria (RESUMEN):** auto-calculated: total ingresos − total egresos = saldo final, with configurable partner split (default 50%/50%)

**Echeqs sub-table** (inside EG-EXTRA): N°, razón social, importe pagado/pendiente, fecha emisión/cobro, estado

## Development phases

- **Fase 1 (MVP):** events CRUD, all 10 tabs, caja, conciliatoria, basic auth
- **Fase 2:** echeqs management, Excel importer (reads existing `.xlsx` template), multi-bank
- **Fase 3:** reports, Excel/PDF export, dashboard KPIs
- **Fase 4:** configurable tab names, supplier ABM, roles, additional business units

## Excel template structure

The `docs/Flujo de Caja Generico.xlsx` is the exact template to replicate. It has 10 sheets matching the categories above. The importer (Fase 2) must parse all 10 sheets and pre-populate the event. The `mammoth` package in `package.json` is available for document reading.

## Infrastructure decision

Planned deployment: AWS (EC2 t3.micro + RDS PostgreSQL + S3). Server-side alternative pending client hardware evaluation. See `Plan_Desarrollo_Sistema_Eventos.docx` Section 3 for full analysis.
