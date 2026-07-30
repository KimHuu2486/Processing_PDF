import { useId, type ReactNode } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";

import { cn } from "../lib/cn";
import { Button, type ButtonVariant } from "./Button";

const overlayClasses = cn(
  "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4",
  "pt-[max(1rem,env(safe-area-inset-top))]",
  "pr-[max(1rem,env(safe-area-inset-right))]",
  "pb-[max(1rem,env(safe-area-inset-bottom))]",
  "pl-[max(1rem,env(safe-area-inset-left))]",
);

const modalClasses =
  "w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl outline-none";

interface DialogContentProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  role?: "dialog" | "alertdialog";
  className?: string;
}

export function DialogContent({
  title,
  description,
  children,
  role = "dialog",
  className,
}: DialogContentProps) {
  const descriptionId = useId();

  return (
    <Dialog
      role={role}
      aria-describedby={description ? descriptionId : undefined}
      className={cn("p-6 outline-none sm:p-7", className)}
    >
      <Heading
        slot="title"
        className="text-balance text-xl font-bold text-slate-950"
      >
        {title}
      </Heading>
      {description ? (
        <div
          id={descriptionId}
          className="mt-2 text-pretty text-sm leading-6 text-slate-600"
        >
          {description}
        </div>
      ) : null}
      {children}
    </Dialog>
  );
}

export interface AlertDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function AlertDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = "Tiếp tục",
  cancelLabel = "Hủy",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: AlertDialogProps) {
  const close = () => onOpenChange(false);

  const handleCancel = () => {
    onCancel?.();
    close();
  };

  const handleConfirm = () => {
    onConfirm();
    close();
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={overlayClasses}
      isDismissable
    >
      <Modal className={modalClasses}>
        <DialogContent
          role="alertdialog"
          title={title}
          description={description}
        >
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onPress={handleCancel}>{cancelLabel}</Button>
            <Button variant={confirmVariant} onPress={handleConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Modal>
    </ModalOverlay>
  );
}

export interface ConfirmDialogProps
  extends Omit<AlertDialogProps, "isOpen" | "onOpenChange"> {
  trigger: ReactNode;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className={overlayClasses} isDismissable>
        <Modal className={modalClasses}>
          <DialogContent
            role="alertdialog"
            title={title}
            description={description}
          >
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                slot="close"
                onPress={onCancel}
              >
                {cancelLabel}
              </Button>
              <Button
                slot="close"
                variant={confirmVariant}
                onPress={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </DialogContent>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
