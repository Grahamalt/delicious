import { NextRequest, NextResponse } from "next/server";
import { getCurrentWeekData } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? new Date(dateParam + "T12:00:00") : undefined;

  try {
    const data = await getCurrentWeekData(date);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Sheets error:", errMsg);
    return NextResponse.json(
      { error: `Failed to fetch sheet data: ${errMsg}` },
      { status: 500 }
    );
  }
}
