import { APP_ID } from "./app";

type DashboardSummary = {
  userId: string;
  totalTrips: number;
  plannedTrips: number;
  completedTrips: number;
  recentTrip?: { title: string; destination: string };
};

async function safePost(url: string | undefined, payload: unknown) {
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Intentionally swallow integration failures to avoid blocking core CRUD.
  }
}

export async function pushDashboardSummary(summary: DashboardSummary) {
  await safePost(import.meta.env.ANSIVERSA_DASHBOARD_WEBHOOK_URL, {
    appId: APP_ID,
    type: "summary",
    summary,
  });
}

export async function pushNotification(params: {
  userId: string;
  title: string;
  message: string;
  level?: "info" | "success";
}) {
  await safePost(import.meta.env.ANSIVERSA_NOTIFICATIONS_WEBHOOK_URL, {
    appId: APP_ID,
    userId: params.userId,
    title: params.title,
    message: params.message,
    level: params.level ?? "info",
  });
}
