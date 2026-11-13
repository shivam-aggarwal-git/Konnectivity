import { NextRequest, NextResponse } from "next/server";
import { searchGifs } from "@/lib/gif-library.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 70) return NextResponse.json({gifs: []});
  try { return NextResponse.json({gifs: await searchGifs(query)}); }
  catch { return NextResponse.json({error: "GIF search is temporarily unavailable."}, {status: 502}); }
}
