import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Panel lateral derecho (drawer) sobre Radix Dialog — mismo comportamiento de foco,
// Escape y clic afuera que Dialog, pero anclado a la derecha y a toda la altura.
// Uso: <Drawer open onOpenChange><DrawerContent>…</DrawerContent></Drawer>

const Drawer = DialogPrimitive.Root;
const DrawerTitle = DialogPrimitive.Title;
const DrawerDescription = DialogPrimitive.Description;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/40',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto',
        'bg-white border-l border-border shadow-xl p-6',
        'data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
        'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring">
        <X size={16} />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DrawerContent.displayName = 'DrawerContent';

export { Drawer, DrawerContent, DrawerTitle, DrawerDescription };
