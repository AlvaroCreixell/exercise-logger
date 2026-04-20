import { Link } from "react-router";
import { Chevron } from "@/shared/icons";

type RowLinkVariant = "default" | "destructive";

interface BaseProps {
  label: string;
  sublabel?: string;
  variant?: RowLinkVariant;
  disabled?: boolean;
}

interface ButtonRowLinkProps extends BaseProps {
  onClick: () => void;
  to?: never;
}

interface LinkRowLinkProps extends BaseProps {
  to: string;
  onClick?: never;
}

type RowLinkProps = ButtonRowLinkProps | LinkRowLinkProps;

const BASE_CLASSES =
  "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:pointer-events-none disabled:opacity-50 hover:bg-sage-soft/40";

export function RowLink(props: RowLinkProps) {
  const { label, sublabel, variant = "default", disabled } = props;
  const labelClass =
    variant === "destructive"
      ? "text-sm font-semibold text-destructive"
      : "text-sm font-semibold text-foreground";

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className={labelClass}>{label}</p>
        {sublabel && <p className="text-meta">{sublabel}</p>}
      </div>
      <Chevron direction="right" className="shrink-0 text-ink-3" />
    </>
  );

  if ("to" in props && props.to !== undefined) {
    return (
      <Link to={props.to} className={BASE_CLASSES} aria-disabled={disabled || undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={disabled}
      className={BASE_CLASSES}
    >
      {content}
    </button>
  );
}
