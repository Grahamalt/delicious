import { NextRequest, NextResponse } from "next/server";
import { checkBearerAuth } from "@/lib/auth";
import { getProgress } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  if (!checkBearerAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const entries = await getProgress();
  return NextResponse.json({ entries });
}
