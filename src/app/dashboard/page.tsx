import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dal";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try {
    data = await getDashboardData();
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") redirect("/sign-in");
    throw error;
  }
  return <DashboardClient data={data} />;
}
