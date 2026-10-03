/** Collapsible table view of a chart, so values never rely on colour alone. */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink-2">Show as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line text-ink-3">
              {head.map((h) => (
                <th key={h} className="py-1.5 pr-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-line last:border-0">
                {r.map((c, i) => (
                  <td key={i} className="py-1.5 pr-4">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
