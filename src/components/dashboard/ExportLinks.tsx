import { adminApi } from "@/client/api";
import { LocalTime } from "../ui/LocalTime";

/** Anonymised CSV downloads (FR24). */
export function ExportLinks({ version, generatedAt }: { version: string; generatedAt: string }) {
  return (
    <section className="flex flex-wrap items-center gap-4 text-sm">
      <span className="text-ink-2">Export anonymised responses:</span>
      <a className="font-medium text-accent underline" href={adminApi.exportUrl("choices", version)}>
        Choices CSV
      </a>
      <a className="font-medium text-accent underline" href={adminApi.exportUrl("stated", version)}>
        Stated reasons CSV
      </a>
      <span className="text-ink-3">
        Updated <LocalTime iso={generatedAt} time />
      </span>
    </section>
  );
}
