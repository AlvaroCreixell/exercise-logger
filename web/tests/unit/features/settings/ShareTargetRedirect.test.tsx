import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import ShareTargetRedirect from "@/features/settings/ShareTargetRedirect";

function ImportProbe() {
  const location = useLocation();
  const state = location.state as { launchYaml?: string } | null;
  return <div>IMPORT[{state?.launchYaml ?? "none"}]</div>;
}

function renderShare(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/share-target${query}`]}>
      <Routes>
        <Route path="/share-target" element={<ShareTargetRedirect />} />
        <Route path="/settings/import" element={<ImportProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe("ShareTargetRedirect", () => {
  it("forwards shared text to the import screen as launchYaml", async () => {
    renderShare(`?text=${encodeURIComponent("version: 1\nname: X")}`);
    // getByText normalizes whitespace, so the newline matches as a space.
    expect(await screen.findByText("IMPORT[version: 1 name: X]")).toBeDefined();
  });

  it("unwraps code fences from the shared text", async () => {
    renderShare(
      `?text=${encodeURIComponent("Here you go!\n```yaml\nversion: 1\n```")}`,
    );
    expect(await screen.findByText("IMPORT[version: 1]")).toBeDefined();
  });

  it("falls back to the title param when text is absent", async () => {
    renderShare(`?title=${encodeURIComponent("version: 1")}`);
    expect(await screen.findByText("IMPORT[version: 1]")).toBeDefined();
  });

  it("redirects with no state when nothing was shared", async () => {
    renderShare("");
    expect(await screen.findByText("IMPORT[none]")).toBeDefined();
  });
});
