import { IconSvg, type IconSvgProps } from "./IconSvg";

type Direction = "right" | "left" | "up" | "down";

type Props = Omit<IconSvgProps, "viewBox" | "children" | "strokeWidth"> & {
  strokeWidth?: number;
  direction?: Direction;
};

const POINTS: Record<Direction, string> = {
  right: "9 18 15 12 9 6",
  left:  "15 18 9 12 15 6",
  down:  "6 9 12 15 18 9",
  up:    "18 15 12 9 6 15",
};

export function Chevron({
  size = 18,
  strokeWidth = 2,
  direction = "right",
  ...rest
}: Props) {
  return (
    <IconSvg size={size} strokeWidth={strokeWidth} viewBox="0 0 24 24" {...rest}>
      <polyline points={POINTS[direction]} />
    </IconSvg>
  );
}
