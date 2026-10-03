import { exportResponses } from "@/application/retailer/exportResponses";
import { exportQuery } from "@/contracts/requests";
import { requireAdmin } from "@/server/auth";
import { container } from "@/server/container";
import { toCsv } from "@/server/csv";
import { parseQuery, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  const { filename, columns, rows } = await exportResponses(container(), parseQuery(req, exportQuery));
  return new Response(toCsv(columns, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
