import * as XLSX from 'xlsx';
import { CategoriaEmpleado, EstadoEmpleado } from '@prisma/client';
import { prisma } from './prisma';

// ── Padrón de empleados (planilla "Datos Personales" de Lorena) ──────────────
// Misma lectura que scripts/importarEmpleadosDos57.ts, ahora desde la
// pantalla para que lo cargue quien lleva el padrón. Hoja "… FIJOS" (o la
// primera), encabezados de columna en la fila 3 y datos desde la fila 4; se
// lee por posición de columna porque hay columnas de encabezado sin usar.
//
// Empleado existente (por CUIT, o por apellido + nombre si no hay CUIT): se
// actualizan sólo los datos que la planilla trae — una celda vacía no borra
// lo cargado en el sistema. Nunca da de baja: los que están en el sistema y
// no en la planilla se listan para revisar.

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

function cell(row: any[] | undefined, idx: number): string | null {
  const v = row?.[idx];
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

// "7/9/1994" (DD/MM/YYYY) → Date en UTC (campo de fecha-calendario, ver fix de offset UTC).
function parseFechaArg(raw: string | null): Date | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const [, d, m, yRaw] = match;
  const y = yRaw.length === 2 ? Number(yRaw) + 2000 : Number(yRaw);
  return new Date(Date.UTC(y, Number(m) - 1, Number(d)));
}

const soloDigitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const normNombre = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface FilaPadron {
  fila:     number; // fila del Excel (1-based)
  nombre:   string; // "Apellido, Nombre"
  cuit:     string | null;
  accion:   'CREAR' | 'ACTUALIZAR' | 'SIN_CAMBIOS';
  cambios:  string[]; // campos que cambian (ACTUALIZAR)
}

export interface ImportarPadronResultado {
  hoja:          string;
  creados:       number;
  actualizados:  number;
  sin_cambios:   number;
  omitidas:      { fila: number; motivo: string }[];
  filas:         FilaPadron[];
  // Activos en el sistema que no aparecen en la planilla (no se tocan)
  no_estan_en_planilla: { id: number; nombre: string }[];
}

const ETIQUETA: Record<string, string> = {
  cuit: 'CUIL', fecha_nacimiento: 'fecha de nacimiento', grupo_sanguineo: 'grupo sanguíneo', domicilio: 'domicilio',
  telefono: 'teléfono', contacto_emergencia_tel: 'contacto de emergencia', contacto_emergencia_nombre: 'contacto de emergencia',
  escalafon: 'escalafón', tipo_contratacion: 'contratación', equipamiento_asignado: 'equipamiento',
  licencia_conducir: 'licencia', talle_pantalon: 'talles', talle_remera: 'talles', talle_buzo: 'talles',
  talle_calzado: 'talles', apodo: 'apodo',
};

const mismoValor = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date
    ? (a instanceof Date ? a.getTime() : null) === (b instanceof Date ? b.getTime() : null)
    : (a ?? null) === (b ?? null);

export async function importarPadronEmpleados(buffer: Buffer, empresaId: number, dryRun: boolean): Promise<ImportarPadronResultado> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const hoja = wb.SheetNames.find(n => /fijos/i.test(n)) ?? wb.SheetNames[0];
  if (!hoja) throw new Error('El archivo no tiene hojas');
  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[hoja], { header: 1, defval: null, raw: false });

  // Validación mínima del formato: encabezado de nombre en A3 y de CUIL en C3
  const h = rows[PRIMERA_FILA_DATOS - 1];
  if (!/nombre|apellido/i.test(cell(h, COL.NOMBRE_COMPLETO) ?? '') || !/cuil|cuit/i.test(cell(h, COL.CUIT) ?? '')) {
    throw new Error(`La hoja "${hoja}" no tiene el formato de la planilla de datos personales (se espera nombre en A3 y CUIL en C3)`);
  }

  const empleados = await prisma.empleado.findMany({ where: { empresa_id: empresaId, deleted_at: null } });
  const porCuit   = new Map(empleados.filter(e => soloDigitos(e.cuit)).map(e => [soloDigitos(e.cuit), e]));
  const porNombre = new Map(empleados.map(e => [normNombre(`${e.apellido} ${e.nombre}`), e]));
  const vistos = new Set<number>();

  const resultado: ImportarPadronResultado = {
    hoja, creados: 0, actualizados: 0, sin_cambios: 0, omitidas: [], filas: [], no_estan_en_planilla: [],
  };

  await prisma.$transaction(async tx => {
    for (let i = PRIMERA_FILA_DATOS; i < rows.length; i++) {
      const row = rows[i];
      const nombreCompleto = cell(row, COL.NOMBRE_COMPLETO);
      if (!nombreCompleto) {
        const tieneOtrosDatos = row?.some((v: any, idx: number) => idx !== COL.NOMBRE_COMPLETO && v !== null && String(v).trim() !== '');
        if (tieneOtrosDatos) resultado.omitidas.push({ fila: i + 1, motivo: 'Fila con datos pero sin nombre' });
        continue;
      }

      const { apellido, nombre } = splitNombreCompleto(nombreCompleto);
      const cuit = cell(row, COL.CUIT);
      const { tel: contactoTel, nombre: contactoNombre } = splitContactoEmergencia(cell(row, COL.CONTACTO_EMERG));
      const escalafonRaw = cell(row, COL.ESCALAFON);
      const escalafon = escalafonRaw ? parseInt(escalafonRaw, 10) : null;

      const leidos: Record<string, unknown> = {
        cuit,
        fecha_nacimiento:           parseFechaArg(cell(row, COL.FECHA_NAC)),
        grupo_sanguineo:            cell(row, COL.GRUPO_SANGUINEO),
        domicilio:                  cell(row, COL.DOMICILIO),
        telefono:                   cell(row, COL.TELEFONO),
        contacto_emergencia_tel:    contactoTel,
        contacto_emergencia_nombre: contactoNombre,
        escalafon:                  Number.isFinite(escalafon) ? escalafon : null,
        tipo_contratacion:          cell(row, COL.TIPO_CONTRAT),
        equipamiento_asignado:      cell(row, COL.EQUIPAMIENTO),
        licencia_conducir:          cell(row, COL.LICENCIA) !== null ? true : null,
        talle_pantalon:             cell(row, COL.TALLE_PANTALON),
        talle_remera:               cell(row, COL.TALLE_REMERA),
        talle_buzo:                 cell(row, COL.TALLE_BUZO),
        talle_calzado:              cell(row, COL.TALLE_CALZADO),
        apodo:                      cell(row, COL.APODO),
      };
      // Sólo lo que la planilla trae: una celda vacía no borra datos del sistema
      const data = Object.fromEntries(Object.entries(leidos).filter(([, v]) => v !== null));

      const existente = (soloDigitos(cuit) && porCuit.get(soloDigitos(cuit))) || porNombre.get(normNombre(`${apellido} ${nombre}`));
      const etiqueta = `${apellido}, ${nombre}`;

      if (existente) {
        if (vistos.has(existente.id)) {
          resultado.omitidas.push({ fila: i + 1, motivo: `${etiqueta}: repetido en la planilla` });
          continue;
        }
        vistos.add(existente.id);
        const cambiados = Object.keys(data).filter(k => !mismoValor((existente as any)[k], data[k]));
        if (cambiados.length === 0) {
          resultado.sin_cambios++;
          resultado.filas.push({ fila: i + 1, nombre: etiqueta, cuit, accion: 'SIN_CAMBIOS', cambios: [] });
          continue;
        }
        if (!dryRun) {
          await tx.empleado.update({ where: { id: existente.id }, data: Object.fromEntries(cambiados.map(k => [k, data[k]])) });
        }
        resultado.actualizados++;
        resultado.filas.push({ fila: i + 1, nombre: etiqueta, cuit, accion: 'ACTUALIZAR', cambios: [...new Set(cambiados.map(k => ETIQUETA[k] ?? k))] });
      } else {
        if (!dryRun) {
          await tx.empleado.create({
            data: {
              ...data, nombre, apellido, empresa_id: empresaId,
              estado: EstadoEmpleado.ACTIVO, categoria: CategoriaEmpleado.OTRO,
            },
          });
        }
        resultado.creados++;
        resultado.filas.push({ fila: i + 1, nombre: etiqueta, cuit, accion: 'CREAR', cambios: [] });
      }
    }
  }, { timeout: 60_000 });

  // Si la planilla es sólo de fijos, los jornaleros del sistema no cuentan como faltantes
  resultado.no_estan_en_planilla = empleados
    .filter(e => !vistos.has(e.id) && e.estado === EstadoEmpleado.ACTIVO && e.categoria !== CategoriaEmpleado.JORNALERO)
    .map(e => ({ id: e.id, nombre: `${e.apellido}, ${e.nombre}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return resultado;
}
