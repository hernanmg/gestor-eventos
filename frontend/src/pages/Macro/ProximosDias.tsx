import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useCalendario, TODOS_LOS_TIPOS } from '@/hooks/useCalendario';
import { COLORES, TIPO_LABEL, getDetailLink, metadataResumen } from '@/lib/calendarioItems';
import type { CalendarioItem } from '@/types';

// ── Agenda "Próximos 7 días" ─────────────────────────────────────────────────
// Los mismos ítems que el Calendario (todos los tipos, ambas empresas para el
// admin global), de hoy a 7 días, agrupados por día.

const DIAS = 7;
const MAX_ITEMS = 8;
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
// Fechas del backend = calendario puro en UTC medianoche (ver [[fecha_offset_utc_fix]]).
function fechaKeyUTC(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export default function ProximosDias() {
  const { desde, hasta, hoy } = useMemo(() => {
    const h = new Date();
    const fin = new Date(h); fin.setDate(fin.getDate() + DIAS);
    return { desde: toDateStr(h), hasta: toDateStr(fin), hoy: toDateStr(h) };
  }, []);
  const tipos = useMemo(() => new Set(TODOS_LOS_TIPOS), []);
  const { data, isLoading } = useCalendario(desde, hasta, tipos);

  const dias = useMemo(() => {
    const items = (data?.items ?? [])
      .filter(i => { const k = fechaKeyUTC(i.fecha); return k >= desde && k <= hasta; })
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, MAX_ITEMS);
    const map = new Map<string, CalendarioItem[]>();
    for (const i of items) {
      const k = fechaKeyUTC(i.fecha);
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()];
  }, [data, desde, hasta]);
  const total = (data?.items ?? []).length;

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="proximos-titulo">
      <div className="flex items-center gap-2 px-0.5">
        <h2 id="proximos-titulo" className="text-[15px] font-semibold">Próximos 7 días</h2>
        <Link to="/calendario" className="ml-auto text-xs font-medium text-link hover:underline">
          {total > MAX_ITEMS ? `Calendario (${total})` : 'Calendario'}
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Cargando agenda…
        </div>
      ) : dias.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          Sin vencimientos ni eventos en los próximos 7 días.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dias.map(([dia, items]) => {
            const [y, m, d] = dia.split('-').map(Number);
            const dow = DOW[new Date(y, m - 1, d).getDay()];
            return (
              <li key={dia} className="flex gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
                <div className={`flex w-11 shrink-0 flex-col items-center justify-center rounded-lg py-1.5 leading-none ${dia === hoy ? 'bg-foreground text-background' : 'bg-secondary'}`}>
                  <span className="font-mono text-base font-semibold tabular-nums">{d}</span>
                  <span className={`mt-0.5 text-[10px] uppercase ${dia === hoy ? 'opacity-80' : 'text-muted-foreground'}`}>{dia === hoy ? 'hoy' : dow}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col divide-y divide-border">
                  {items.map(item => {
                    const info = metadataResumen(item)[0];
                    return (
                      <Link key={item.id} to={getDetailLink(item)} className="group flex items-center gap-2 py-1 first:pt-0 last:pb-0">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORES[item.tipo] }} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium group-hover:underline">{item.titulo}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {TIPO_LABEL[item.tipo]}{info && <> · {info}</>}
                          </span>
                        </span>
                        <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
