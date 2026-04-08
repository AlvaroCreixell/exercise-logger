import type { ReactNode } from "react";

interface SupersetGroupProps {
  children: ReactNode;
}

export function SupersetGroup({ children }: SupersetGroupProps) {
  return (
    <div className="border-l-2 border-info pl-3 space-y-3">
      <span className="text-xs text-info font-medium">Superset</span>
      {children}
    </div>
  );
}
