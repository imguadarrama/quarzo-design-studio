import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/Button/Button";
import styles from "./ConfirmDialog.module.scss";

type ConfirmDialogVariant = "danger" | "primary";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  isConfirming = false,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(next) => {
        if (!next && !isConfirming) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content
          role="alertdialog"
          className={styles.dialog}
          onEscapeKeyDown={(event) => {
            if (isConfirming) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isConfirming) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isConfirming) event.preventDefault();
          }}
        >
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className={styles.description}>{description}</div>
          </Dialog.Description>
          <div className={styles.actions}>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isConfirming}
              >
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant={variant}
              onClick={onConfirm}
              size="sm"
              disabled={isConfirming}
            >
              {isConfirming ? "Eliminando…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
