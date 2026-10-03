export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-warn-line bg-warn-bg p-3 text-sm">
      <span>{message}. Your earlier answers are saved.</span>
      <button type="button" onClick={onRetry} className="font-medium underline">
        Try again
      </button>
    </div>
  );
}
