import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** If provided, shows a second confirmation step with this text. */
  doubleConfirmText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  doubleConfirmText,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setStep(1);
    }
    onOpenChange(newOpen);
  }

  function handleConfirm() {
    if (doubleConfirmText && step === 1) {
      setStep(2);
      return;
    }
    setStep(1);
    onOpenChange(false);
    onConfirm();
  }

  function handleCancel() {
    setStep(1);
    onOpenChange(false);
  }

  const currentTitle = step === 2 ? "Are you absolutely sure?" : title;
  const currentDescription = step === 2 ? doubleConfirmText! : description;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{currentTitle}</DialogTitle>
          <DialogDescription>{currentDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {step === 2 ? "Yes, I'm sure" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
