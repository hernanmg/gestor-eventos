import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import BaseTable from '@/components/ui/BaseTable';
import { Button } from '@/components/ui/button';
import { GUIA_INTRO, GUIA_PASOS, type FilaGuia } from '@/lib/guiaCargaEnjoy';
import { cn } from '@/lib/utils';

// Guía de carga de datos de Enjoy (primer ítem de la Ayuda). Los tildes son
// una ayuda para quien carga: se guardan solo en este navegador.
const STORAGE_KEY = 'guia_carga_enjoy_hechos';

function leerHechos(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {}; } catch { return {}; }
}

function Donde({ f }: { f: FilaGuia }) {
  if (!f.ruta) return <span>{f.donde}</span>;
  return <Link to={f.ruta} className="text-link hover:underline">{f.donde}</Link>;
}

export default function GuiaCargaPage() {
  const [hechos, setHechos] = useState<Record<string, boolean>>(leerHechos);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(hechos)); } catch { /* sin almacenamiento */ }
  }, [hechos]);

  const toggle = (id: string) => setHechos(h => ({ ...h, [id]: !h[id] }));

  const total  = GUIA_PASOS.reduce((n, p) => n + (p.filas?.length ?? 0) + (p.tareas?.length ?? 0), 0);
  const listos = Object.values(hechos).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Guía de carga de datos — Enjoy"
        subtitle={GUIA_INTRO}
        meta={<span className="text-xs text-muted-foreground">{listos} de {total} hechos</span>}
        actions={listos > 0 && (
          <Button variant="outline" size="sm" onClick={() => setHechos({})}>
            <RotateCcw size={14} className="mr-1.5" /> Desmarcar todo
          </Button>
        )}
      />

      {GUIA_PASOS.map(paso => (
        <section key={paso.id} className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">{paso.titulo}</h2>
          {paso.intro && <p className="max-w-3xl text-sm text-muted-foreground">{paso.intro}</p>}

          {paso.filas && (
            <BaseTable className="text-sm">
              <thead>
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="w-10 px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Qué</th>
                  <th className="px-2 py-2 text-left">Planilla</th>
                  <th className="px-2 py-2 text-left">Dónde se carga</th>
                  <th className="px-2 py-2 text-left">Qué revisar</th>
                </tr>
              </thead>
              <tbody>
                {paso.filas.map(f => (
                  <tr key={f.id} className={cn(hechos[f.id] && 'opacity-60')}>
                    <td className="px-2 py-2 align-top" data-label="Hecho">
                      <input type="checkbox" checked={!!hechos[f.id]} onChange={() => toggle(f.id)} aria-label={`Marcar ${f.que} como hecho`} />
                    </td>
                    <td className="px-2 py-2 align-top text-muted-foreground">{f.id}</td>
                    <td className={cn('px-2 py-2 align-top font-medium', hechos[f.id] && 'line-through')}>{f.que}</td>
                    <td className="px-2 py-2 align-top">{f.planilla ?? '—'}</td>
                    <td className="px-2 py-2 align-top"><Donde f={f} /></td>
                    <td className="px-2 py-2 align-top text-muted-foreground">{f.revisar}</td>
                  </tr>
                ))}
              </tbody>
            </BaseTable>
          )}

          {paso.tareas && (
            <ul className="space-y-1.5">
              {paso.tareas.map(t => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={!!hechos[t.id]} onChange={() => toggle(t.id)} aria-label={`Marcar ${t.que} como hecho`} />
                  <span className={cn(hechos[t.id] && 'line-through opacity-60')}>
                    <span className="font-medium text-foreground">{t.que}</span>
                    {t.donde && <> · <Donde f={t} /></>}
                    {t.revisar && <span className="text-muted-foreground"> — {t.revisar}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {paso.nota && <p className="max-w-3xl text-xs italic text-muted-foreground">{paso.nota}</p>}
        </section>
      ))}
    </div>
  );
}
