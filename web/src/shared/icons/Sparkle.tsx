import type { SVGProps } from "react";

interface SparkleProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height" | "fill"> {
  size?: number;
}

export function Sparkle({ size = 14, "aria-label": ariaLabel, ...rest }: SparkleProps) {
  const a11y = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true as const };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...a11y}
      {...rest}
    >
      <path d="M12 2l2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z" />
    </svg>
  );
}
