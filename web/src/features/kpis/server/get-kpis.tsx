import "server-only";
import { getKpis } from "@/shared/db/queries/kpis";
import { KpiRow } from "../components/kpi-row";

export async function KpiRowServer() {
  const data = await getKpis();
  return <KpiRow data={data} />;
}
