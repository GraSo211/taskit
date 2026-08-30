import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dal";
import { isValidDateKey } from "@/lib/task-time";
import DashboardClient from "../dashboard/DashboardClient";

type DailyPageProps = {
  searchParams: Promise<{ date?: string | string[] | undefined }>;
};

export default async function DailyPage({ searchParams }: DailyPageProps) {
  const { date } = await searchParams;
  const selectedDateKey = typeof date === "string" && isValidDateKey(date) ? date : undefined;
  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try { data = await getDashboardData(new Date(), selectedDateKey); }
  catch (error) { if (error instanceof Error && error.message === "Unauthorized") redirect("/sign-in"); throw error; }
  return <DashboardClient data={data} view="daily" />;
}
