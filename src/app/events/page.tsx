import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dal";
import EventsClient from "./EventsClient";

export default async function EventsPage() {
  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try { data = await getDashboardData(); } catch (error) { if (error instanceof Error && error.message === "Unauthorized") redirect("/sign-in"); throw error; }
  return <EventsClient data={data} />;
}
