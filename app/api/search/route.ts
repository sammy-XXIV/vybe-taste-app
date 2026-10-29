import { NextRequest, NextResponse } from "next/server";
import { searchEntity } from "@/lib/qloo";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const type = req.nextUrl.searchParams.get("type") ?? undefined;
  if (!q) return NextResponse.json([]);
  const results = await searchEntity(q, type);
  return NextResponse.json(results);
}
