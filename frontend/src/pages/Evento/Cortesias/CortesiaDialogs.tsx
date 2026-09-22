import { useState } from 'react';
import { Plus, Trash2, Upload, AlertTriangle, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BaseTable from '@/components/ui/BaseTable';
import { cn, getApiErrorMessage } from '@/lib/utils';
import {
  useCreateCortesia, useUpdateCortesia, useImportarCortesias,
  type CortesiaEvento, type CortesiaPayload, type CortesiaImportResultado, type EstadoVinculo,
} from '@/hooks/useCortesias';

const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-0.5';

// Tipos que usa Enjoy en sus eventos con inscripción (L'Etape…): se ofrecen como sugerencia
// junto con los que ya existan en el evento. El campo es de texto libre.
const TIPOS_BASE = [
  'Ruta Larga - Kit Estándar', 'Ruta Larga - Kit Full', 'Ruta Larga - Tourmalet',
  'Ruta Corta - Kit Estándar', 'Ruta Corta - Kit Full', 'Ruta Corta - Tourmalet',
];

// ── Nueva / editar cortesía ───────────────────────────────────────────────────

interface ItemForm {
  key:       number;
  id?:       number;
  tipo:      string;
  cantidad:  string;
  bib:       string;
  apellido:  string;
  nombre:    string;
  dni:       string;
  email:     string;
  inscripto: boolean; // mostrar los campos del inscripto
}

let keySeq = 0;
const itemVacio = (): ItemForm => ({ key: ++keySeq, tipo: '', cantidad: '1', bib: '', apellido: '', nombre: '', dni: '', email: '', inscripto: false });

export function CortesiaFormDialog({ eventoId, cortesia, tiposExistentes, onClose }: {
  eventoId:        number;
  cortesia?:       CortesiaEvento; // si viene, es edición
  tiposExistentes: string[];
  onClose:         () => void;
}) {
  const create = useCreateCortesia(eventoId);
  const update = useUpdateCortesia(eventoId);

  const [cliente, setCliente]       = useState(cortesia?.cliente_nombre ?? '');
  const [contacto, setContacto]     = useState(cortesia?.contacto_nombre ?? '');
  const [autoriza, setAutoriza]     = useState(cortesia?.autorizado_por ?? '');
  const [observacion, setObs]       = useState(cortesia?.observacion ?? '');
  const [items, setItems]           = useState<ItemForm[]>(() =>
    cortesia
      ? cortesia.items.map(i => ({
          key: ++keySeq, id: i.id, tipo: i.tipo_ticket, cantidad: String(i.cantidad),
          bib: i.bib_number ?? '', apellido: i.apellido_inscripto ?? '', nombre: i.nombre_inscripto ?? '', dni: i.dni ?? '', email: i.email ?? '',
          inscripto: !!(i.bib_number || i.apellido_inscripto || i.nombre_inscripto || i.dni || i.email),
        }))
      : [itemVacio()],
  );
  const [error, setError] = useState<string | null>(null);
  const isPending = create.isPending || update.isPending;

  const setItem = (key: number, patch: Partial<ItemForm>) => setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));
  const sugerencias = Array.from(new Set([...tiposExistentes, ...TIPOS_BASE]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!cliente.trim()) { setError('El cliente es requerido'); return; }
    const validos = items.filter(i => i.tipo.trim() || (i.cantidad !== '' && i.cantidad !== '1'));
    if (validos.length === 0) { setError('Cargá al menos un tipo de ticket'); return; }
    for (const i of validos) {
      const n = Number(i.cantidad);
      if (!i.tipo.trim()) { setError('Cada fila necesita un tipo de ticket'); return; }
      if (!Number.isInteger(n) || n <= 0) { setError(`La cantidad de "${i.tipo}" debe ser un entero mayor a 0`); return; }
    }
    const payload: CortesiaPayload = {
      cliente_nombre:  cliente.trim(),
      contacto_nombre: contacto.trim() || null,
      autorizado_por:  autoriza.trim() || null,
      observacion:     observacion.trim() || null,
      items: validos.map(i => ({
        ...(i.id !== undefined && { id: i.id }),
        tipo_ticket: i.tipo.trim(),
        cantidad:    Number(i.cantidad),
        bib_number:         i.bib.trim() || null,
        apellido_inscripto: i.apellido.trim() || null,
        nombre_inscripto:   i.nombre.trim() || null,
        dni:                i.dni.trim() || null,
        email:              i.email.trim() || null,
      })),
    };
    try {
      if (cortesia) await update.mutateAsync({ id: cortesia.id, data: payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{cortesia ? 'Editar cortesía' : 'Nueva cortesía'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelCls}>Cliente *</label>
            <input className={inputCls} value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Empresa o persona" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Persona de contacto</label>
              <input className={inputCls} value={contacto} onChange={e => setContacto(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Autoriza</label>
              <input className={inputCls} value={autoriza} onChange={e => setAutoriza(e.target.value)} placeholder="Ej: MATIAS" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Observación</label>
            <input className={inputCls} value={observacion} onChange={e => setObs(e.target.value)} placeholder="Ej: Sponsors, Municipios, Tiendas Amigas…" />
          </div>

          <div>
            <p className={labelCls}>Tickets *</p>
            <datalist id="cortesia-tipos">{sugerencias.map(t => <option key={t} value={t} />)}</datalist>
            <div className="space-y-2">
              {items.map(i => (
                <div key={i.key} className="rounded-md border border-border p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className={cn(inputCls, 'flex-1')} list="cortesia-tipos" placeholder="Tipo de ticket (ej: Ruta Larga - Kit Full)"
                      value={i.tipo} onChange={e => setItem(i.key, { tipo: e.target.value })}
                    />
                    <input
                      className={cn(inputCls, 'w-20 text-right')} type="number" min={1} step={1} aria-label="Cantidad"
                      value={i.cantidad} onChange={e => setItem(i.key, { cantidad: e.target.value })}
                    />
                    <button
                      type="button" onClick={() => setItem(i.key, { inscripto: !i.inscripto })}
                      title="Datos del inscripto (Njuko)"
                      className={cn('p-1.5 rounded border text-muted-foreground hover:bg-accent', i.inscripto && 'bg-accent text-foreground')}
                    >
                      <UserRound size={14} />
                    </button>
                    <button
                      type="button" onClick={() => setItems(prev => prev.filter(x => x.key !== i.key))}
                      disabled={items.length === 1} title="Quitar"
                      className="p-1.5 rounded text-destructive hover:bg-destructive/10 disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {i.inscripto && (
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} placeholder="Bib number" value={i.bib} onChange={e => setItem(i.key, { bib: e.target.value })} />
                      <input className={inputCls} placeholder="DNI" value={i.dni} onChange={e => setItem(i.key, { dni: e.target.value })} />
                      <input className={inputCls} placeholder="Apellido" value={i.apellido} onChange={e => setItem(i.key, { apellido: e.target.value })} />
                      <input className={inputCls} placeholder="Nombre" value={i.nombre} onChange={e => setItem(i.key, { nombre: e.target.value })} />
                      <input className={cn(inputCls, 'col-span-2')} type="email" placeholder="Email" value={i.email} onChange={e => setItem(i.key, { email: e.target.value })} />
                      {Number(i.cantidad) > 1 && (
                        <p className="col-span-2 text-[11px] text-muted-foreground">Los datos del inscripto corresponden a un solo ticket; con cantidad mayor a 1 conviene cargar un renglón por persona.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setItems(prev => [...prev, itemVacio()])} className="h-7 text-xs mt-1.5 text-muted-foreground hover:text-foreground">
              <Plus size={13} className="mr-1" /> Agregar tipo de ticket
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? 'Guardando…' : cortesia ? 'Guardar cambios' : 'Crear cortesía'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Importar desde Excel ──────────────────────────────────────────────────────

const VINCULO_LABEL: Record<EstadoVinculo, string> = {
  VINCULADO:          'vinculados',
  SIN_COINCIDENCIA:   'sin inscripto con ese nombre',
  TIPO_DISTINTO:      'con otro kit en Njuko',
  AMBIGUO:            'con varios inscriptos posibles',
  CANTIDAD_MAYOR_A_1: 'con más de un ticket',
  YA_ASIGNADO:        'con inscripto ya asignado',
};

type Paso = 'archivo' | 'preview' | 'exito';

export function ImportarCortesiasDialog({ eventoId, onClose }: { eventoId: number; onClose: () => void }) {
  const [paso, setPaso]           = useState<Paso>('archivo');
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<CortesiaImportResultado | null>(null);
  const [resultado, setResultado] = useState<CortesiaImportResultado | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const importar = useImportarCortesias(eventoId);

  const handleFile = async (f: File) => {
    setFile(f); setError(null);
    try {
      setPreview(await importar.mutateAsync({ file: f, preview: true }));
      setPaso('preview');
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const handleConfirmar = async () => {
    if (!file) return;
    setError(null);
    try {
      setResultado(await importar.mutateAsync({ file, preview: false }));
      setPaso('exito');
    } catch (err) { setError(getApiErrorMessage(err)); }
  };

  const noVinc = preview ? Object.entries(preview.inscriptos.no_vinculados) : [];

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Importar cortesías desde Excel</DialogTitle></DialogHeader>

        {paso === 'archivo' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí la planilla de cortesías (ej. <span className="font-medium">Cortesias - Male.xlsx</span>). Se crea una asignación por cada fila de
              cliente con tickets. Si ya cargaste esas cortesías, se actualizan en vez de duplicarse.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:bg-accent/30 transition">
              <Upload size={22} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{importar.isPending ? 'Leyendo archivo…' : 'Hacé clic para elegir el archivo .xlsx'}</span>
              <input type="file" accept=".xlsx" className="hidden" disabled={importar.isPending}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {paso === 'preview' && preview && (
          <div className="space-y-3">
            {preview.evento_excel.evento && (
              <p className="text-xs text-muted-foreground">
                La planilla dice: <span className="font-medium text-foreground">{preview.evento_excel.evento}</span>
                {preview.evento_excel.fecha ? ` — ${preview.evento_excel.fecha}` : ''}. Verificá que sea este evento.
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span><span className="font-semibold text-green-700">{preview.creadas}</span> asignaciones a crear</span>
              <span><span className="font-semibold">{preview.actualizadas}</span> a actualizar</span>
              <span><span className="font-semibold">{preview.tickets}</span> tickets en total</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {preview.por_tipo.map(t => (
                <span key={t.tipo_ticket} className="text-xs rounded-full bg-secondary px-2 py-0.5">{t.tipo_ticket}: <strong>{t.cantidad}</strong></span>
              ))}
            </div>

            {preview.inscriptos.hoja && (
              <div className="text-xs rounded bg-blue-50 text-blue-900 px-3 py-2 space-y-0.5">
                <p>
                  Inscriptos de Njuko (hoja "{preview.inscriptos.hoja}"): <strong>{preview.inscriptos.leidos.toLocaleString('es-AR')}</strong> leídos ·{' '}
                  <strong>{preview.inscriptos.vinculados}</strong> cortesía(s) vinculada(s) por nombre y kit.
                </p>
                {noVinc.length > 0 && (
                  <p>
                    Sin vincular: {noVinc.map(([k, n]) => `${n} ${VINCULO_LABEL[k as EstadoVinculo]}`).join(' · ')}.
                    Los inscriptos se vinculan sólo si el nombre y el kit coinciden; el resto se carga a mano desde "Editar".
                  </p>
                )}
              </div>
            )}
            {preview.omitidas.length > 0 && (
              <div className="text-xs bg-yellow-50 text-yellow-800 rounded px-3 py-2">
                <p className="font-medium mb-0.5 flex items-center gap-1"><AlertTriangle size={12} /> Filas omitidas:</p>
                <p>{preview.omitidas.map(o => `fila ${o.fila_excel} (${o.motivo})`).join(', ')}</p>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto">
              <BaseTable className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Cliente</th>
                    <th className="px-2 py-1.5 text-left">Contacto</th>
                    <th className="px-2 py-1.5 text-left">Observación</th>
                    <th className="px-2 py-1.5 text-right">Tickets</th>
                    <th className="px-2 py-1.5 text-left">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.filas.map(f => (
                    <tr key={f.fila_excel}>
                      <td className="px-2 py-1">{f.cliente}</td>
                      <td className="px-2 py-1">{f.contacto ?? '—'}</td>
                      <td className="px-2 py-1 text-muted-foreground">{f.observacion ?? '—'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{f.total}</td>
                      <td className="px-2 py-1">
                        {f.accion === 'CREAR' ? 'Crear' : 'Actualizar'}
                        {f.vinculo === 'VINCULADO' && <span className="ml-1 text-blue-700" title={`Bib ${f.inscripto?.bib ?? '—'}`}>· inscripto</span>}
                        {f.advertencias.length > 0 && <AlertTriangle size={11} className="inline ml-1 text-yellow-700" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </BaseTable>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setPaso('archivo'); setPreview(null); }}>Atrás</Button>
              <Button size="sm" onClick={handleConfirmar} disabled={importar.isPending}>{importar.isPending ? 'Importando…' : 'Confirmar importación'}</Button>
            </div>
          </div>
        )}

        {paso === 'exito' && resultado && (
          <div className="space-y-3">
            <p className="text-sm">
              Importación completa: <span className="font-semibold text-green-700">{resultado.creadas}</span> asignaciones creadas,{' '}
              <span className="font-semibold">{resultado.actualizadas}</span> actualizadas — {resultado.tickets} tickets en total.
            </p>
            <div className="flex justify-end pt-1"><Button size="sm" onClick={onClose}>Cerrar</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
