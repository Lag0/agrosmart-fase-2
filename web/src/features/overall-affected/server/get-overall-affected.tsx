import "server-only";
import { getOverallAffected } from "@/shared/db/queries/overall-affected";
import { OverallAffectedCard } from "../components/overall-affected-card";

export async function OverallAffectedServer() {
  const data = await getOverallAffected();
  return <OverallAffectedCard data={data} />;
}
