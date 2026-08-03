import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Unlock } from 'lucide-react';
import { useListaPartes } from '@/hooks/useParteDiario';
import { Badge } from '@/components/ui/badge';

export default function ParteDiarioHistorialPage() {
  const navigate = useNavigate();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const { data: partes = [], isLoading } = useListaPartes({
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
  });

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/parte-diario" className="text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold">Historial de Partes Diarios</h1>
      </div>

      <div className="flex items-center gap-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-0.5">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-0.5">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-white">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Cargando...</p>
        ) : partes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">No hay partes diarios registrados en este rango.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground text-left">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2 text-center">Personas</th>
                <th className="px-3 py-2 text-center">Jornadas creadas</th>
                <th className="px-3 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {partes.map(p => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/parte-diario?fecha=${p.fecha.slice(0, 10)}`)}
                  className="border-b border-border/60 last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 font-medium">{p.fecha.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.titulo ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{p.total_personas}</td>
                  <td className="px-3 py-2 text-center">{p.jornadas_creadas}</td>
                  <td className="px-3 py-2 text-center">
                    {p.cerrado ? (
                      <Badge variant="info"><Lock size={11} className="mr-1 inline" />Cerrado</Badge>
                    ) : (
                      <Badge variant="muted"><Unlock size={11} className="mr-1 inline" />Abierto</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
