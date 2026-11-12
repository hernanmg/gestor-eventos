import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { CategoriaEmpleado } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { withTenant } from '../lib/tenant';
import { registrarAuditoria } from '../lib/auditoria';
import { formatCuit } from '../lib/libroComprasImporter';
import {
  parseFormularioProveedores, consolidarFilas, dividirNombre, parseContactoEmergencia,
  type FilaFormulario, type ErrorFilaFormulario,
} from '../lib/proveedoresFormularioImporter';

const NOTA_IMPORT = 'Importado desde formulario Google';

// El unique de Proveedor.cuit es global (no por empresa) y las cargas manuales lo
// guardan con guiones (XX-XXXXXXXX-X) — se busca en ambos formatos.
const variantesCuit = (digitos: string) => [digitos, formatCuit(digitos)];

// Sólo los campos que el formulario trajo: una respuesta vacía no borra lo ya cargado.
const definidos = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;

function notasProveedor(r: FilaFormulario): string {
  const partes = [NOTA_IMPORT];
  if (!r.cuit && r.dni) {
    partes.push(`CUIT inválido en el formulario${r.cuit_original ? ` ("${r.cuit_original}")` : ''}; identificado por DNI ${r.dni}`);
  }
  if (r.factura_ambigua) partes.push('Factura: Tipo A o C según el evento');
  return partes.join(' | ');
}

// POST /api/importar/proveedores-formulario?preview=true|false
// preview=true (default): procesa todo sin escribir. preview=false: aplica.
export async function importarProveedoresFormulario(req: Request, res: Response) {
  if (!req.file) { res.status(400).json({ error: 'Se requiere un archivo .xlsx' }); return; }
  const dryRun    = req.query.preview !== 'false';
  const empresaId = req.empresaId!;
  const userId    = req.user!.id;

  let parseo: ReturnType<typeof parseFormularioProveedores>;
  try {
    parseo = parseFormularioProveedores(req.file.buffer);
  } catch (err: any) {
    res.status(400).json({ error: 'Error al procesar el archivo', detail: err.message }); return;
  }

  const errores: ErrorFilaFormulario[] = [...parseo.errores];
  const { registros, duplicados } = consolidarFilas(parseo.filas);
  const proveedores = registros.filter(r => r.destino === 'PROVEEDOR');
  const empleados   = registros.filter(r => r.destino === 'EMPLEADO');

  // ── Datos de referencia (lectura, fuera de la transacción) ──────────────────
  const cuits = [...new Set(proveedores.map(r => r.cuit).filter((c): c is string => !!c))];
  const dnisSinCuit = [...new Set(proveedores.filter(r => !r.cuit).map(r => r.dni).filter((d): d is string => !!d))];

  const [proveedoresPorCuitDB, proveedoresPorDniDB, empleadosDB] = await Promise.all([
    cuits.length
      ? prisma.proveedor.findMany({
          where:  { cuit: { in: cuits.flatMap(variantesCuit) } },
          select: { id: true, cuit: true, empresa_id: true, deleted_at: true, notas: true },
        })
      : [],
    dnisSinCuit.length
      ? prisma.proveedor.findMany({
          where:  { ...withTenant(empresaId), deleted_at: null, cuit: null, dni: { in: dnisSinCuit } },
          select: { id: true, dni: true, notas: true },
        })
      : [],
    empleados.length
      ? prisma.empleado.findMany({
          where:  { ...withTenant(empresaId), deleted_at: null },
          select: { id: true, dni: true, cuit: true },
        })
      : [],
  ]);
  const provPorCuit = new Map(proveedoresPorCuitDB.map(p => [p.cuit!.replace(/\D/g, ''), p]));
  const provPorDni  = new Map(proveedoresPorDniDB.map(p => [p.dni!, p]));
  const empPorCuit  = new Map(empleadosDB.filter(e => e.cuit).map(e => [e.cuit!.replace(/\D/g, ''), e]));
  const empPorDni   = new Map(empleadosDB.filter(e => e.dni).map(e => [e.dni!, e]));

  // ── Resultado ───────────────────────────────────────────────────────────────
  let proveedores_creados = 0, proveedores_actualizados = 0, empleados_creados = 0, empleados_actualizados = 0;

  const procesar = async (db: Prisma.TransactionClient) => {
    // ── Proveedores ───────────────────────────────────────────────────────────
    for (const r of proveedores) {
      const datos = {
        dni: r.dni, email: r.email, telefono: r.telefono, banco: r.banco,
        alias_bancario: r.alias, cbu: r.cbu, numero_cuenta: r.numero_cuenta, titular_cuenta: r.titular_cuenta,
        puede_facturar: r.puede_facturar, tipo_factura: r.tipo_factura, servicio: r.servicio,
      };

      const existente = r.cuit ? provPorCuit.get(r.cuit) : provPorDni.get(r.dni!);
      if (existente && 'empresa_id' in existente && (existente.empresa_id !== empresaId || existente.deleted_at)) {
        errores.push({
          fila:   r.fila_excel,
          motivo: `El CUIT ${formatCuit(r.cuit!)} ya está registrado como proveedor ${existente.deleted_at ? 'eliminado' : 'de otra empresa'}`,
        });
        continue;
      }

      if (existente) {
        proveedores_actualizados++;
        if (!dryRun) {
          await db.proveedor.update({
            where: { id: existente.id },
            data: {
              ...definidos(datos),
              // No se pisan las notas que ya tenga cargadas a mano.
              ...(!existente.notas && { notas: notasProveedor(r) }),
              updated_by: userId,
            },
          });
        }
      } else {
        proveedores_creados++;
        if (!dryRun) {
          await db.proveedor.create({
            data: {
              ...withTenant(empresaId),
              nombre: r.nombre,
              cuit:   r.cuit ? formatCuit(r.cuit) : null,
              ...datos,
              notas:  notasProveedor(r),
              created_by: userId, updated_by: userId,
            },
          });
        }
      }
    }

    // ── Jornaleros → Empleado ─────────────────────────────────────────────────
    for (const r of empleados) {
      const { nombre, apellido } = dividirNombre(r.nombre)!;
      const contacto = parseContactoEmergencia(r.contacto_emergencia);
      const datos = {
        dni: r.dni, cuit: r.cuit ? formatCuit(r.cuit) : null,
        email: r.email, telefono: r.telefono, domicilio: r.direccion,
        banco: r.banco, alias: r.alias, cbu: r.cbu,
        fecha_nacimiento: r.fecha_nacimiento,
        contacto_emergencia_nombre: contacto.nombre, contacto_emergencia_tel: contacto.tel,
      };

      // [empresa_id, cuit] primero, después [empresa_id, dni].
      const existente = (r.cuit ? empPorCuit.get(r.cuit) : undefined) ?? (r.dni ? empPorDni.get(r.dni) : undefined);

      if (existente) {
        empleados_actualizados++;
        // No se pisa nombre ni categoría: el legajo ya cargado manda (podría ser CHOFER, etc.).
        if (!dryRun) await db.empleado.update({ where: { id: existente.id }, data: definidos(datos) });
      } else {
        empleados_creados++;
        if (!dryRun) {
          await db.empleado.create({
            data: {
              ...withTenant(empresaId),
              nombre, apellido,
              ...datos,
              categoria: CategoriaEmpleado.JORNALERO,
              created_by: userId,
            },
          });
        }
      }
    }
  };

  try {
    if (dryRun) {
      await procesar(prisma as unknown as Prisma.TransactionClient);
    } else {
      await prisma.$transaction(async tx => {
        await procesar(tx);
        await registrarAuditoria({
          usuarioId: userId, empresaId, accion: 'CREATE', entidad: 'Proveedor',
          descripcion: `Importó el formulario de proveedores/jornaleros — proveedores: ${proveedores_creados} creados, ${proveedores_actualizados} actualizados; empleados: ${empleados_creados} creados, ${empleados_actualizados} actualizados`,
          ip: req.ip, tx: tx as any,
        });
      }, { timeout: 120_000, maxWait: 10_000 });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Error al importar el formulario', detail: err.message }); return;
  }

  errores.sort((a, b) => a.fila - b.fila);
  res.json({
    preview: dryRun,
    total_filas: parseo.total_filas,
    proveedores_creados, proveedores_actualizados,
    empleados_creados, empleados_actualizados,
    // Cada fila con datos queda contada: creada/actualizada, descartada por error o
    // absorbida por una respuesta más reciente del mismo CUIT/DNI.
    omitidos: errores.length + duplicados,
    duplicados_en_archivo: duplicados,
    errores,
  });
}
