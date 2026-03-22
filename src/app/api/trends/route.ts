import { NextResponse } from "next/server";
import { getYearlySummary } from "@/lib/sheets";

export async function GET() {
  try {
    const data = await getYearlySummary();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
