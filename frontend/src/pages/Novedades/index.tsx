import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import NovedadesLista from '@/components/novedades/NovedadesLista';
import TiposNovedadDialog from '@/components/novedades/TiposNovedadDialog';

// Libro de novedades (pilar 10): todo lo que pasa y hay que dejar asentado,
// junto, separado por tipo y ordenado por gravedad. ?abrir=N abre una novedad
// (links de la campanita y del calendario).
export default function NovedadesPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const abrir = Number(params.get('abrir')) || null;
  const [tipos, setTipos] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <PageHeader
        title="Novedades"
        subtitle="Lo que pasa en los eventos y en la operación: choques, roturas, faltantes, problemas con proveedores. Lo grave le llega a quien corresponde."
        actions={user?.rol === 'ADMIN' && (
          <Button variant="outline" onClick={() => setTipos(true)}><Settings2 size={15} className="mr-1.5" /> Tipos y avisos</Button>
        )}
      />
      <NovedadesLista
        abrirId={abrir}
        onAbrirConsumido={() => { params.delete('abrir'); setParams(params, { replace: true }); }}
      />
      <TiposNovedadDialog open={tipos} onOpenChange={setTipos} />
    </div>
  );
}
