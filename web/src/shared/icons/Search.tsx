import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

// Fallback shape — no `search` key exists in handoff screens.jsx. Feather-style magnifier.
export function Search({ size = 18, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.2" y1="16.2" x2="21" y2="21" />
    </IconSvg>
  );
}
