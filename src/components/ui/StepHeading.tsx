/** Step title that receives focus on step change, for screen-reader users. */
export function StepHeading({
  ref,
  children,
}: {
  ref: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}) {
  return (
    <h1 ref={ref} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
      {children}
    </h1>
  );
}
