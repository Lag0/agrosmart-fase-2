import "server-only";
import { getTimeSeries } from "@/shared/db/queries/time-series";
import { TimeSeriesCard } from "../components/time-series-card";

export async function TimeSeriesServer() {
  const data = await getTimeSeries();
  return <TimeSeriesCard data={data} />;
}
