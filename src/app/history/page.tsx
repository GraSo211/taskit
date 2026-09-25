import { redirect } from "next/navigation";
import { getHistoryData } from "@/lib/dal";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  let data: Awaited<ReturnType<typeof getHistoryData>>;
  try { data = await getHistoryData(); } catch (error) { if (error instanceof Error && error.message === "Unauthorized") redirect("/sign-in"); throw error; }
  return <HistoryClient data={data} />;
}
