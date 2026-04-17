import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";

// Mock the PWA register hook before importing the component.
const mockUpdate = vi.fn(async () => {});
let mockNeedRefresh = false;
const mockSetNeedRefresh = vi.fn((v: boolean) => {
  mockNeedRefresh = v;
});

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, mockSetNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdate,
  }),
}));

import { SWUpdatePrompt } from "@/app/SWUpdatePrompt";

describe("SWUpdatePrompt", () => {
  beforeEach(() => {
    mockNeedRefresh = false;
    mockUpdate.mockClear();
    mockSetNeedRefresh.mockClear();
  });

  afterEach(() => {
    cleanup();
    // Clean up any toasts that leaked between tests.
    toast.dismiss();
  });

  it("renders nothing when there is no update available", () => {
    const { container } = render(
      <>
        <Toaster />
        <SWUpdatePrompt />
      </>
    );
    // No toast text should be present.
    expect(container.textContent ?? "").not.toMatch(/update available/i);
  });

  it("shows an Update toast when needRefresh becomes true", async () => {
    mockNeedRefresh = true;
    const { getByText } = render(
      <>
        <Toaster />
        <SWUpdatePrompt />
      </>
    );
    await waitFor(() => {
      expect(getByText(/update available/i)).toBeInTheDocument();
    });
  });

  it("calls updateServiceWorker(true) when the reload action is clicked", async () => {
    mockNeedRefresh = true;
    const user = userEvent.setup();
    const { getByRole } = render(
      <>
        <Toaster />
        <SWUpdatePrompt />
      </>
    );
    const reloadBtn = await waitFor(() =>
      getByRole("button", { name: /reload/i })
    );
    await user.click(reloadBtn);
    expect(mockUpdate).toHaveBeenCalledWith(true);
  });
});
