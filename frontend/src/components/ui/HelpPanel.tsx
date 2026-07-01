import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle, X, ChevronRight, Loader2 } from 'lucide-react';
import { getHelpContent, type HelpLink } from '@/lib/helpContent';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'help_panel_open';

// Extrae el :id del pathname actual para resolver links con ":id"
function resolveRuta(ruta: string, pathname: string): string {
  const match = pathname.match(/\/eventos\/(\d+)/);
  const id    = match?.[1];
  return id ? ruta.replace(':id', id) : ruta.replace(/\/:id/, '');
}

export default function HelpPanel() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? 'true' : 'false'); } catch {}
  }, [open]);

  const content = getHelpContent(location.pathname);

  if (location.pathname === '/login') return null;

  // Maneja un link del panel: navega o dispara acción
  const handleLink = async (link: HelpLink) => {
    if (link.ruta) {
      navigate(resolveRuta(link.ruta, location.pathname));
      setOpen(false);
      return;
    }
    if (!link.accion) return;

    setLoadingAction(link.accion);
    try {
      switch (link.accion) {
        case 'abrir_evento_ejemplo': {
          const eventos = await api.get('/eventos').then(r => r.data as { id: number; estado: string; nombre: string }[]);
          const ejemplo = eventos.find(e => e.estado === 'CERRADO') ?? eventos[0];
          if (ejemplo) { navigate(`/eventos/${ejemplo.id}`); setOpen(false); }
          break;
        }
        default:
          // Eventos personalizados que cada página puede escuchar
          window.dispatchEvent(new CustomEvent(`help:${link.accion}`));
          setOpen(false);
      }
    } catch {
      // silencioso — si falla la navegación al ejemplo, no mostrar error
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      {/* Overlay (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed top-0 right-0 z-40 h-full bg-white border-l border-border shadow-xl',
          'transition-transform duration-200 ease-in-out',
          'w-full md:w-[380px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-label="Panel de ayuda"
        role="complementary"
      >
        {/* Header */}
        <div className="flex items-center gap-2 h-14 px-4 border-b border-border shrink-0">
          <HelpCircle size={18} className="text-primary" />
          <h2 className="flex-1 text-sm font-semibold">Ayuda</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1.5 hover:bg-accent transition-colors text-muted-foreground"
            aria-label="Cerrar ayuda"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-3.5rem)] p-4 space-y-5">
          {content ? (
            <>
              {/* Título + descripción */}
              <div>
                <p className="text-base font-semibold text-foreground">{content.titulo}</p>
                {content.descripcion && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {content.descripcion}
                  </p>
                )}
              </div>

              {/* Secciones */}
              {content.secciones.map((s, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{s.titulo}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {s.contenido}
                  </p>
                </div>
              ))}

              {/* Links rápidos */}
              {content.links && content.links.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Links rápidos
                  </p>
                  {content.links.map((link, i) => {
                    const isLoading = loadingAction === link.accion;
                    return (
                      <button
                        key={i}
                        onClick={() => handleLink(link)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-wait"
                      >
                        {isLoading
                          ? <Loader2 size={12} className="animate-spin shrink-0" />
                          : <ChevronRight size={12} className="shrink-0" />}
                        {link.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Fallback cuando no hay contenido para la ruta actual */
            <div className="text-sm text-muted-foreground space-y-3">
              <p className="font-medium text-foreground">Bienvenido al sistema de gestión</p>
              <p>Navegá a cualquier sección para ver ayuda contextual.</p>
              <ul className="space-y-1 list-none">
                {[
                  { label: 'Eventos',     ruta: '/eventos'     },
                  { label: 'Facturas',    ruta: '/facturas'    },
                  { label: 'Proveedores', ruta: '/proveedores' },
                  { label: 'Importar',    ruta: '/importer'    },
                ].map(l => (
                  <li key={l.ruta}>
                    <button
                      onClick={() => handleLink(l)}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ChevronRight size={12} />
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Floating "?" button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex items-center justify-center',
          'h-10 w-10 rounded-full shadow-lg transition-colors',
          open
            ? 'bg-primary text-primary-foreground'
            : 'bg-white text-primary border border-border hover:bg-primary/5',
        )}
        aria-label={open ? 'Cerrar ayuda' : 'Abrir ayuda'}
      >
        <HelpCircle size={20} />
      </button>
    </>
  );
}
