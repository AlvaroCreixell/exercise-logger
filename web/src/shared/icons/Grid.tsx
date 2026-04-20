import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

// Fallback shape — no `grid` key exists in handoff screens.jsx. 2×2 rounded-rect tiles.
export function Grid({ size = 18, strokeWidth = 1.6, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </IconSvg>
  );
}
