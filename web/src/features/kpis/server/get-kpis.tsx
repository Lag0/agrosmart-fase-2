import "server-only";
import { SectionCards } from "@/components/section-cards-agro";
import { getKpis } from "@/shared/db/queries/kpis";

export async function KpiCardsServer() {
  const data = await getKpis();
  return <SectionCards data={data} />;
}
