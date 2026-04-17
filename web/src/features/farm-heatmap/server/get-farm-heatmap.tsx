import "server-only";
import { getHeatmap } from "@/shared/db/queries/heatmap";
import { FarmHeatmapCard } from "../components/farm-heatmap-card";

export async function FarmHeatmapServer() {
  const data = await getHeatmap();
  return <FarmHeatmapCard data={data} />;
}
