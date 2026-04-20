import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function Check({ size = 16, strokeWidth = 3, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <polyline points="20 6 9 17 4 12" />
    </IconSvg>
  );
}
