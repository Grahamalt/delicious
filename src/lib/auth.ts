import { NextRequest } from "next/server";

export function checkBearerAuth(req: NextRequest): boolean {
  const expected = process.env.QUICK_LOG_KEY;
  if (!expected) return true;
  const provided = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const urlKey = req.nextUrl.searchParams.get("key") || "";
  return provided === expected || urlKey === expected;
}
