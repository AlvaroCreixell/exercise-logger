import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
};

export function History({ size = 32, strokeWidth = 1.75, ...rest }: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <path d="M3 3v5h5" />
      <path d="M3.05 13a9 9 0 1 0 .5-4.72L3 8" />
      <path d="M12 7v5l3 2" />
    </IconSvg>
  );
}
