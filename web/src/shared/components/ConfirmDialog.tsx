import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { toast } from "sonner";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => Promise<void> | void;
  /**
   * Optional handler invoked when `onConfirm` rejects. When provided,
   * the default toast fallback is suppressed — the caller owns the
   * UX. When omitted, the dialog surfaces the error via
   * `toast.error(message)` so destructive actions cannot fail silently.
   * In both cases the dialog stays open after the error.
   */
  onError?: (err: unknown) => void;
  variant?: "default" | "destructive";
  doubleConfirm?: boolean;
  doubleConfirmText?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  onError,
  variant = "default",
  doubleConfirm = false,
  doubleConfirmText = "Tap again to confirm",
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [confirmedOnce, setConfirmedOnce] = useState(false);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setConfirmedOnce(false);
        setPending(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const handleConfirm = useCallback(async () => {
    if (doubleConfirm && !confirmedOnce) {
      setConfirmedOnce(true);
      return;
    }
    setPending(true);
    try {
      await onConfirm();
      handleOpenChange(false);
    } catch (err) {
      setPending(false);
      if (onError) {
        onError(err);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message);
      }
      // Dialog remains open so the user can retry or cancel.
    }
  }, [doubleConfirm, confirmedOnce, onConfirm, onError, handleOpenChange]);

  const buttonLabel = doubleConfirm && confirmedOnce
    ? doubleConfirmText
    : confirmText;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-sm gap-3 p-5">
        <AlertDialogHeader className="gap-2">
          <AlertDialogTitle className="text-title-serif text-[1.35rem] leading-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-ink-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mx-0 mb-0 flex-row gap-2 border-none bg-transparent p-0 pt-1">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
            className="flex-1"
          >
            {pending ? "..." : buttonLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
