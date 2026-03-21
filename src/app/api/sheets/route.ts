import { NextRequest, NextResponse } from "next/server";
import { getCurrentWeekData } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-app-password");
  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? new Date(dateParam + "T12:00:00") : undefined;

  try {
    const data = await getCurrentWeekData(date);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Sheets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sheet data" },
      { status: 500 }
    );
  }
}
