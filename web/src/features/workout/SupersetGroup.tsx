import type { ReactNode } from "react";
import { SectionHeader } from "@/shared/components/SectionHeader";

interface SupersetGroupProps {
  children: ReactNode;
}

export function SupersetGroup({ children }: SupersetGroupProps) {
  return (
    <div className="border-l-2 border-cta pl-4 space-y-3">
      <SectionHeader className="!text-cta">Superset</SectionHeader>
      {children}
    </div>
  );
}
