type Variant = "primary" | "secondary";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink",
  secondary: "border border-line text-ink",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-5 py-3 font-medium disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    />
  );
}
