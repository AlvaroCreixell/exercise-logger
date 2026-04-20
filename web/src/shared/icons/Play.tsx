import { IconSvg, type IconSvgProps } from "./IconSvg";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth">;

export function Play({ size = 14, ...rest }: Props) {
  return (
    <IconSvg size={size} viewBox="0 0 24 24" stroke="none" {...rest}>
      <polygon points="6 3 21 12 6 21 6 3" fill="currentColor" />
    </IconSvg>
  );
}
