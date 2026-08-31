import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { FloatingOverlayProvider } from "@/contexts/FloatingOverlayContext";
import { isLeadNestedLayerEvent, isPrimaryDialogBackdrop, shouldPreventDialogOutsideClose } from "@/lib/dialog-outside-guard";
import { floatingAgendaDialogClass, nestedModalClass } from "@/lib/overlay-z-index";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 glass-overlay-mogno data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className ?? "z-50",
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Acima do painel flutuante da agenda (z-200) — popups internos da agenda. */
    floatingLayer?: boolean;
    /** Classe extra no overlay (ex.: z alto dentro de outro dialog). */
    overlayClassName?: string;
    /** Clique no véu escuro (fora do card). */
    onOverlayClick?: React.PointerEventHandler<HTMLDivElement>;
    /** Acima de um Dialog aberto (z-50) — janelas internas do card do lead. */
    nested?: boolean;
  }
>(({
  className,
  floatingLayer,
  overlayClassName,
  onOverlayClick,
  nested,
  children,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  ...props
}, ref) => (
  <DialogPortal>
    <DialogOverlay
      data-nested-dialog={nested ? '' : undefined}
      className={cn(
        floatingLayer ? floatingAgendaDialogClass : "z-50",
        nested && !overlayClassName && nestedModalClass,
        overlayClassName,
      )}
      onPointerUp={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.button !== 0) return;
        onOverlayClick?.(event);
      }}
    />
    <DialogPrimitive.Content
      ref={ref}
      data-floating-agenda-root={floatingLayer ? '' : undefined}
      data-nested-dialog={nested ? '' : undefined}
      onPointerDownOutside={(event) => {
        // Tela cheia / janela interna: preventDefault aqui cancela o clique original
        // (botões mortos, textarea sem foco). O card permanece aberto pelas guardas.
        if (isLeadNestedLayerEvent(event)) {
          onPointerDownOutside?.(event);
          return;
        }
        if (onOverlayClick) event.preventDefault();
        if (shouldPreventDialogOutsideClose(event)) event.preventDefault();
        onPointerDownOutside?.(event);
      }}
      onFocusOutside={(event) => {
        if (isLeadNestedLayerEvent(event)) {
          onFocusOutside?.(event);
          return;
        }
        if (shouldPreventDialogOutsideClose(event)) event.preventDefault();
        onFocusOutside?.(event);
      }}
      onInteractOutside={(event) => {
        if (isLeadNestedLayerEvent(event)) {
          onInteractOutside?.(event);
          return;
        }
        if (onOverlayClick && isPrimaryDialogBackdrop(event.target)) event.preventDefault();
        if (shouldPreventDialogOutsideClose(event)) event.preventDefault();
        onInteractOutside?.(event);
      }}
      className={cn(
        "fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 glass-dialog p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-xl",
        floatingLayer ? floatingAgendaDialogClass : "z-50",
        nested && nestedModalClass,
        className,
      )}
      {...props}
    >
      <FloatingOverlayProvider value={!!floatingLayer}>
        {children}
      </FloatingOverlayProvider>
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
