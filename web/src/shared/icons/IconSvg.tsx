import type { ReactNode, SVGProps } from "react";

export interface IconSvgProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  strokeWidth?: number;
  viewBox: string;
  children: ReactNode;
}

export function IconSvg({
  size = 18,
  strokeWidth,
  viewBox,
  children,
  "aria-label": ariaLabel,
  ...rest
}: IconSvgProps) {
  const a11y = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
      {...rest}
    >
      {children}
    </svg>
  );
}
