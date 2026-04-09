import type { ReactNode } from "react";

interface SupersetGroupProps {
  children: ReactNode;
}

export function SupersetGroup({ children }: SupersetGroupProps) {
  return (
    <div className="border-l-2 border-cta pl-4 space-y-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-cta">Superset</span>
      {children}
    </div>
  );
}
