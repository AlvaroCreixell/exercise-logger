import type { ReactNode } from "react";

interface SettingRowProps {
  label: string;
  sublabel?: string;
  children: ReactNode;
}

export function SettingRow({ label, sublabel, children }: SettingRowProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {sublabel && <p className="text-meta">{sublabel}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
