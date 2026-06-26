import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle, X, ChevronRight } from 'lucide-react';
import { getHelpContent } from '@/lib/helpContent';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'help_panel_open';

export default function HelpPanel() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? 'true' : 'false'); } catch {}
  }, [open]);

  const content = getHelpContent(location.pathname);

  // Hide on login
  if (location.pathname === '/login') return null;

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
              <p className="text-base font-semibold text-foreground">{content.title}</p>
              {content.sections.map((s, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  {s.links?.map(link => (
                    <button
                      key={link.to}
                      onClick={() => { navigate(link.to); setOpen(false); }}
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ChevronRight size={12} />
                      {link.label}
                    </button>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <div className="text-sm text-muted-foreground space-y-3">
              <p className="font-medium text-foreground">Bienvenido al sistema de gestión</p>
              <p>Navegá a cualquier sección para ver ayuda contextual.</p>
              <ul className="space-y-1 list-none">
                {[
                  { label: 'Eventos',    to: '/eventos'     },
                  { label: 'Facturas',   to: '/facturas'    },
                  { label: 'Stock',      to: '/stock'       },
                  { label: 'Proveedores', to: '/proveedores' },
                ].map(l => (
                  <li key={l.to}>
                    <button
                      onClick={() => { navigate(l.to); setOpen(false); }}
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
