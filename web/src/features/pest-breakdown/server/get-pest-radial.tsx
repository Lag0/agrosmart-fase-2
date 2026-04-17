import "server-only";
import { getPestBreakdown } from "@/shared/db/queries/pest-breakdown";
import { PestRadialCard } from "../components/pest-radial-card";

export async function PestRadialServer() {
  const data = await getPestBreakdown();
  return <PestRadialCard data={data} />;
}
