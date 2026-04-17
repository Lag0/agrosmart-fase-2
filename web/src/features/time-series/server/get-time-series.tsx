import "server-only";
import { getTimeSeries } from "@/shared/db/queries/time-series";
import { TimeSeriesChart } from "../components/time-series-card";

export async function TimeSeriesServer() {
  const data = await getTimeSeries();
  return <TimeSeriesChart data={data} />;
}
