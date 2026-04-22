import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardShell } from "@/features/onboarding/components/WizardShell";

function renderShell(props: Partial<Parameters<typeof WizardShell>[0]> = {}) {
  const defaults = {
    stepIndex: 0,
    totalSteps: 11,
    category: "Schedule",
    title: "How many days?",
    subtitle: "Pick a number.",
    onBack: () => {},
    onNext: () => {},
    onClose: () => {},
    children: <div>input slot</div>,
  } as const;
  return render(<WizardShell {...defaults} {...props} />);
}

describe("WizardShell", () => {
  it("renders a progress bar with aria-valuenow = stepIndex + 1", () => {
    renderShell({ stepIndex: 3, totalSteps: 11 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("4");
    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("11");
  });

  it("disables Back on step 0", () => {
    renderShell({ stepIndex: 0 });
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("hides Next when hideNext is true", () => {
    renderShell({ hideNext: true });
    expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument();
  });

  it("clicking the close button opens a confirm dialog; confirming calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderShell({ onClose });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /exit questionnaire/i }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // Click the confirm "Exit" button inside the dialog.
    await user.click(screen.getByRole("button", { name: /^exit$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the hero heading on mount", () => {
    renderShell({ title: "Focus me" });
    const heading = screen.getByRole("heading", { name: "Focus me" });
    expect(heading).toHaveFocus();
  });
});
