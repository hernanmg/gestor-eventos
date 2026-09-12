import { Printer } from 'lucide-react';
import { Button } from './button';
import { useAuth } from '@/hooks/useAuth';
import { useLogoBlobUrl } from '@/hooks/useEmpresas';

// Botón "Exportar PDF" — imprime lo que ya está en pantalla (window.print())
// en vez de armar una copia oculta aparte. Todo lo que no debe salir en el
// PDF lleva clase "no-print" (ver index.css); cada sección imprimible tiene
// su propio <PrintHeader> con clase "print-only".
export function PrintButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      variant="outline" size="sm" className="no-print"
      onClick={() => { onClick?.(); window.print(); }}
    >
      <Printer size={14} className="mr-1.5" /> Exportar PDF
    </Button>
  );
}

// Encabezado que sólo aparece en el PDF/impresión — logo de la empresa
// activa (si tiene), título de la sección, período y fecha de generación.
export function PrintHeader({ titulo, periodo }: { titulo: string; periodo: string }) {
  const { user } = useAuth();
  const logoUrl = useLogoBlobUrl(user?.empresa?.id, user?.empresa?.tiene_logo ?? false);

  return (
    <div className="print-only mb-4 border-b pb-3">
      <div className="flex items-center gap-2 mb-1">
        {logoUrl && <img src={logoUrl} alt={user?.empresa?.nombre ?? ''} className="h-8 w-8 object-contain" />}
        <span className="text-sm font-medium">{user?.empresa?.nombre ?? 'Admin Portal'}</span>
      </div>
      <h1 className="text-lg font-bold">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{periodo}</p>
      <p className="text-xs text-muted-foreground">Generado el {new Date().toLocaleString('es-AR')}</p>
    </div>
  );
}
