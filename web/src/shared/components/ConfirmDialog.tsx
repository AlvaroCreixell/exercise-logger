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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => Promise<void> | void;
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
    } catch {
      setPending(false);
    }
  }, [doubleConfirm, confirmedOnce, onConfirm, handleOpenChange]);

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
