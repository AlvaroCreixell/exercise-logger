import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { extractSharedYaml } from "@/shared/lib/extractSharedYaml";

/**
 * Landing route for the PWA Web Share Target (manifest `share_target`, GET).
 * Android's share sheet opens /share-target?title=…&text=…&url=… when the
 * user shares text to the installed app — unwrap any code fences and hand the
 * YAML to the import screen. Some apps put the payload in `title`, so fall
 * back to it when `text` is absent.
 */
export default function ShareTargetRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get("text") ?? searchParams.get("title") ?? "";
    const yaml = extractSharedYaml(raw);
    navigate("/settings/import", {
      replace: true,
      state: yaml === "" ? undefined : { launchYaml: yaml },
    });
  }, [navigate, searchParams]);

  return null;
}
