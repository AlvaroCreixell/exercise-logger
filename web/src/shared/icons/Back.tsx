import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Back({ size = 22, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </IconSvg>
  );
}
