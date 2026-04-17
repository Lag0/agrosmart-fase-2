import "server-only";
import { getPestBreakdown } from "@/shared/db/queries/pest-breakdown";
import { PestBreakdownCard } from "../components/pest-breakdown-card";

export async function PestBreakdownServer() {
  const data = await getPestBreakdown();
  return <PestBreakdownCard data={data} />;
}
