import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { cn } from "@/shared/lib/utils";

export interface WizardShellProps {
  stepIndex: number;
  totalSteps: number;
  category: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  hideNext?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function WizardShell({
  stepIndex,
  totalSteps,
  category,
  title,
  subtitle,
  onBack,
  onNext,
  nextDisabled = false,
  hideNext = false,
  onClose,
  children,
}: WizardShellProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  const fillPercent = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 py-5">
      {/* Top bar: progress + close */}
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Questionnaire progress"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={stepIndex + 1}
          className="h-0.5 flex-1 overflow-hidden rounded-full bg-[var(--line-soft)]"
        >
          <div
            className="h-full bg-sage transition-[width] duration-200"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <button
          type="button"
          aria-label="Exit questionnaire"
          onClick={() => setConfirmOpen(true)}
          className="text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded-full p-1"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/* Eyebrow + hero + subtitle */}
      <div className="flex flex-col gap-2">
        <div className="text-eyebrow text-ink-2">
          STEP {stepIndex + 1} OF {totalSteps} · {category.toUpperCase()}
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-hero-serif italic text-ink focus:outline-none"
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-ink-2 leading-relaxed">{subtitle}</p>
        )}
      </div>

      {/* Input slot */}
      <div className="flex-1">{children}</div>

      {/* Footer */}
      <div
        className={cn(
          "flex gap-2",
          hideNext ? "justify-start" : "justify-between"
        )}
      >
        <Button
          variant="outline"
          onClick={onBack}
          disabled={stepIndex === 0}
        >
          Back
        </Button>
        {!hideNext && (
          <Button onClick={onNext} disabled={nextDisabled}>
            Next
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save and exit?"
        description="Your answers stay on this device — continue from the welcome screen any time."
        confirmText="Save and exit"
        onConfirm={onClose}
      />
    </div>
  );
}
