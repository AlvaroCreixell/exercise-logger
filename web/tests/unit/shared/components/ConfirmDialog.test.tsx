import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("ConfirmDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and description when open", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete routine?"
        description="This cannot be undone."
        confirmText="Delete"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText("Delete routine?")).toBeVisible();
    expect(screen.getByText("This cannot be undone.")).toBeVisible();
  });

  it("calls async onConfirm and shows pending state", async () => {
    const user = userEvent.setup();
    let resolve: () => void;
    const onConfirm = vi.fn(
      () => new Promise<void>((r) => { resolve = r; })
    );
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Clear data?"
        description="All data will be lost."
        confirmText="Clear"
        onConfirm={onConfirm}
        variant="destructive"
      />
    );
    const btn = screen.getByRole("button", { name: "Clear" });
    await user.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(btn).toBeDisabled();
    resolve!();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("calls sync onConfirm and closes immediately", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Finish?"
        description="Are you sure?"
        confirmText="Finish"
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requires two clicks when doubleConfirm is true", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Discard?"
        description="All data will be lost."
        confirmText="Discard"
        onConfirm={onConfirm}
        variant="destructive"
        doubleConfirm
        doubleConfirmText="Tap again to confirm"
      />
    );
    const btn = screen.getByRole("button", { name: "Discard" });
    await user.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Tap again to confirm")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tap again to confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not render when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Hidden"
        description="Should not appear"
        confirmText="OK"
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});

describe("ConfirmDialog error surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onError when onConfirm rejects and onError is provided", async () => {
    const user = userEvent.setup();
    const err = new Error("boom");
    const onError = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Confirm"
        description="Are you sure?"
        confirmText="Yes"
        onConfirm={async () => { throw err; }}
        onError={onError}
      />
    );
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(onError).toHaveBeenCalledWith(err);
    expect(toast.error).not.toHaveBeenCalled();
    // Dialog should remain open (handleOpenChange(false) NOT called for the close path).
    // Cancel-path or success-path opens onOpenChange(false); error path does not.
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("falls back to toast.error when onError is not provided", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Confirm"
        description="Are you sure?"
        confirmText="Yes"
        onConfirm={async () => { throw new Error("kaboom"); }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(toast.error).toHaveBeenCalledWith("kaboom");
  });

  it("closes the dialog on a successful onConfirm", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Confirm"
        description="Are you sure?"
        confirmText="Yes"
        onConfirm={async () => { /* resolve */ }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
