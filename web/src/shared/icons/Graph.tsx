import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

// Uses the `history` key from handoff screens.jsx (curved arrow + clock hand), mapped to Graph.
export function Graph({ size = 18, strokeWidth = 1.6, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </IconSvg>
  );
}
