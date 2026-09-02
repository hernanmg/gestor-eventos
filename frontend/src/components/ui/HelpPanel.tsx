import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { HelpCircle, X, ChevronRight, Loader2, Search, LifeBuoy } from 'lucide-react';
import { getHelpContent, searchHelp, type HelpLink, type HelpSection, type HelpInlineLink, type HelpSearchResult } from '@/lib/helpContent';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'help_panel_open';

// Extrae el :id del pathname actual para resolver links con ":id"
function resolveRuta(ruta: string, pathname: string): string {
  const match = pathname.match(/\/eventos\/(\d+)/);
  const id    = match?.[1];
  return id ? ruta.replace(':id', id) : ruta.replace(/\/:id/, '');
}

// Renderiza el contenido de una sección — string simple con saltos de línea,
// o un array mezclando texto plano con HelpInlineLink (renderizado como
// <Link> navegable que cierra el panel al clickear).
function ContenidoSection({ contenido, pathname, onNavigate }: {
  contenido: HelpSection['contenido']; pathname: string; onNavigate: () => void;
}) {
  if (typeof contenido === 'string') {
    return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{contenido}</p>;
  }
  return (
    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
      {contenido.map((t, i) => typeof t === 'string' ? (
        <span key={i}>{t}</span>
      ) : (
        <Link
          key={i}
          to={resolveRuta(t.ruta, pathname)}
          onClick={onNavigate}
          className="text-primary font-medium hover:underline"
        >
          {t.texto}
        </Link>
      ))}
    </p>
  );
}

function VerTambien({ links, pathname, onNavigate }: { links: HelpInlineLink[]; pathname: string; onNavigate: () => void }) {
  if (links.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Ver también:{' '}
      {links.map((l, i) => (
        <span key={i}>
          <Link to={resolveRuta(l.ruta, pathname)} onClick={onNavigate} className="text-primary hover:underline">
            {l.texto}
          </Link>
          {i < links.length - 1 && ' · '}
        </span>
      ))}
    </p>
  );
}

export default function HelpPanel() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? 'true' : 'false'); } catch {}
  }, [open]);

  // La búsqueda se limpia al cerrar el panel o cambiar de página, para no
  // dejar resultados de otra sección pegados la próxima vez que se abre.
  useEffect(() => { if (!open) setQuery(''); }, [open]);
  useEffect(() => { setQuery(''); }, [location.pathname]);

  const content = getHelpContent(location.pathname);
  const searching = query.trim().length > 0;
  const searchResults: HelpSearchResult[] = searching ? searchHelp(query) : [];

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

        {/* Buscador — global, busca en todas las páginas, no sólo la actual */}
        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar en la ayuda..."
              className="w-full border border-input rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-3.5rem-3.25rem)] p-4 space-y-5">
          {searching ? (
            searchResults.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="flex items-center gap-1.5"><LifeBuoy size={14} className="shrink-0" /> No encontramos ayuda para eso. ¿Necesitás soporte?</p>
                <p className="text-xs">Probá con otra palabra, o contactá a soporte técnico.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}</p>
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { navigate(resolveRuta(r.ruta, location.pathname)); setOpen(false); }}
                    className="block w-full text-left rounded-md border border-border p-3 hover:bg-accent transition-colors"
                  >
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">{r.pageTitulo}</p>
                    <p className="text-sm font-medium text-foreground">{r.section.titulo}</p>
                  </button>
                ))}
              </div>
            )
          ) : content ? (
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
                  <ContenidoSection contenido={s.contenido} pathname={location.pathname} onNavigate={() => setOpen(false)} />
                  {s.veTambien && (
                    <VerTambien links={s.veTambien} pathname={location.pathname} onNavigate={() => setOpen(false)} />
                  )}
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
