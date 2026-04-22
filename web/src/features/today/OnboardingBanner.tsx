import { useNavigate } from "react-router";

export interface OnboardingBannerProps {
  onDismiss: () => void;
}

export function OnboardingBanner({ onDismiss }: OnboardingBannerProps) {
  const navigate = useNavigate();
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--line)] bg-sage-soft px-4 py-3 text-ink-2"
    >
      <button
        type="button"
        onClick={() => navigate("/onboarding/handoff")}
        className="flex-1 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded"
      >
        📋 Paste your routine YAML here →
      </button>
      <button
        type="button"
        aria-label="Dismiss banner"
        onClick={onDismiss}
        className="flex size-6 items-center justify-center rounded-full text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
