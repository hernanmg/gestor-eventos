// ═══════════════════════════════════════════════════════════════════════════
// Importa el personal fijo de DOS57 desde
// docs/dos57/Datos DOS57_Datos Personales.xlsx, hoja "DOS57 FIJOS".
//
// Layout real del Excel (verificado — no coincide 1:1 con "encabezado en
// fila 1"): fila 1 vacía, fila 2 tiene los títulos de sección ("DATOS DE
// CONTACTO", "INSTITUCIONAL", "DATOS UNIFORME"), fila 3 son los encabezados
// de columna reales, los datos arrancan en la fila 4. Se lee con header:1
// (array de arrays) e indexado por columna en vez de por nombre de
// encabezado, porque hay columnas de encabezado sin usar (F,G,H,N) que
// harían frágil un mapeo por nombre.
//
// Run: npx ts-node --files scripts/importarEmpleadosDos57.ts
// ═══════════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import path from 'path';
import * as XLSX from 'xlsx';
import { PrismaClient, CategoriaEmpleado, EstadoEmpleado } from '@prisma/client';

const prisma = new PrismaClient();

const ARCHIVO = path.join(__dirname, '..', '..', 'docs', 'dos57', 'Datos DOS57_Datos Personales.xlsx');
const HOJA    = 'DOS57 FIJOS';
const PRIMERA_FILA_DATOS = 3; // 0-based — fila 4 del Excel

// Índices de columna (0-based, A=0)
const COL = {
  NOMBRE_COMPLETO: 0,  // A
  APODO:           1,  // B
  CUIT:            2,  // C
  FECHA_NAC:       3,  // D
  GRUPO_SANGUINEO: 4,  // E
  DOMICILIO:       8,  // I
  TELEFONO:        9,  // J
  CONTACTO_EMERG:  10, // K
  ESCALAFON:       11, // L
  TIPO_CONTRAT:    12, // M
  EQUIPAMIENTO:    14, // O
  LICENCIA:        15, // P
  TALLE_PANTALON:  16, // Q
  TALLE_REMERA:    17, // R
  TALLE_BUZO:      18, // S
  TALLE_CALZADO:   19, // T
};

function cell(row: any[], idx: number): string | null {
  const v = row[idx];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// "Arias Gonzalo Daniel" → { apellido: "Arias", nombre: "Gonzalo Daniel" }
function splitNombreCompleto(raw: string): { apellido: string; nombre: string } {
  const partes = raw.trim().split(/\s+/);
  return { apellido: partes[0], nombre: partes.slice(1).join(' ') || partes[0] };
}

// "3541-331614 (madre Flores Nora)" → { tel: "3541-331614", nombre: "madre Flores Nora" }
function splitContactoEmergencia(raw: string | null): { tel: string | null; nombre: string | null } {
  if (!raw) return { tel: null, nombre: null };
  const match = raw.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (match) return { tel: match[1].trim() || null, nombre: match[2].trim() || null };
  return { tel: raw, nombre: null };
}

// "7/9/1994" (DD/MM/YYYY, formato argentino) → Date en UTC (evita el bug de
// offset de un día por huso horario en campos que son sólo fecha-calendario).
function parseFechaArg(raw: string | null): Date | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const [, d, m, yRaw] = match;
  const y = yRaw.length === 2 ? Number(yRaw) + 2000 : Number(yRaw);
  return new Date(Date.UTC(y, Number(m) - 1, Number(d)));
}

async function main() {
  const empresa = await prisma.empresa.findFirst({ where: { nombre_corto: 'DOS57' } });
  if (!empresa) throw new Error('No se encontró la empresa DOS57 — correr el seed principal primero');

  const wb    = XLSX.readFile(ARCHIVO);
  const sheet = wb.Sheets[HOJA];
  if (!sheet) throw new Error(`No se encontró la hoja "${HOJA}" en ${ARCHIVO}`);

  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: false });

  let creados     = 0;
  let actualizados = 0;
  let omitidos    = 0;

  for (let i = PRIMERA_FILA_DATOS; i < rows.length; i++) {
    const row = rows[i];
    const nombreCompleto = cell(row, COL.NOMBRE_COMPLETO);
    if (!nombreCompleto) {
      // Fila totalmente vacía (relleno del sheet, no cuenta) vs. fila con
      // datos pero sin Col A (caso real a omitir según la consigna).
      const tieneOtrosDatos = row?.some((v: any, idx: number) => idx !== COL.NOMBRE_COMPLETO && v !== null && String(v).trim() !== '');
      if (tieneOtrosDatos) omitidos++;
      continue;
    }

    const { apellido, nombre } = splitNombreCompleto(nombreCompleto);
    const cuit = cell(row, COL.CUIT);
    const { tel: contactoTel, nombre: contactoNombre } = splitContactoEmergencia(cell(row, COL.CONTACTO_EMERG));
    const escalafonRaw = cell(row, COL.ESCALAFON);

    const data = {
      nombre,
      apellido,
      cuit,
      fecha_nacimiento:           parseFechaArg(cell(row, COL.FECHA_NAC)),
      grupo_sanguineo:            cell(row, COL.GRUPO_SANGUINEO),
      domicilio:                  cell(row, COL.DOMICILIO),
      telefono:                   cell(row, COL.TELEFONO),
      contacto_emergencia_tel:    contactoTel,
      contacto_emergencia_nombre: contactoNombre,
      escalafon:                  escalafonRaw ? parseInt(escalafonRaw, 10) : null,
      tipo_contratacion:          cell(row, COL.TIPO_CONTRAT),
      equipamiento_asignado:      cell(row, COL.EQUIPAMIENTO),
      licencia_conducir:          cell(row, COL.LICENCIA) !== null,
      talle_pantalon:             cell(row, COL.TALLE_PANTALON),
      talle_remera:               cell(row, COL.TALLE_REMERA),
      talle_buzo:                 cell(row, COL.TALLE_BUZO),
      talle_calzado:              cell(row, COL.TALLE_CALZADO),
      apodo:                      cell(row, COL.APODO),
    };

    // Upsert por [empresa_id, cuit] si hay cuit, si no por [empresa_id, nombre+apellido]
    const existing = cuit
      ? await prisma.empleado.findFirst({ where: { empresa_id: empresa.id, cuit, deleted_at: null } })
      : await prisma.empleado.findFirst({ where: { empresa_id: empresa.id, nombre, apellido, deleted_at: null } });

    if (existing) {
      await prisma.empleado.update({ where: { id: existing.id }, data });
      actualizados++;
      console.log(`  actualizado: ${apellido}, ${nombre}`);
    } else {
      await prisma.empleado.create({
        data: {
          ...data,
          empresa_id: empresa.id,
          estado:     EstadoEmpleado.ACTIVO,
          categoria:  CategoriaEmpleado.OTRO,
        },
      });
      creados++;
      console.log(`  creado: ${apellido}, ${nombre}`);
    }
  }

  console.log('\nResumen:', { creados, actualizados, omitidos });
}

main()
  .catch((e) => {
    console.error('Error en importación:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
