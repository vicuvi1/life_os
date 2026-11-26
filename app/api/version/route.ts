import { NextResponse } from "next/server";

// The id of the build that is live right now. An open tab compares it with the
// id it was built with (NEXT_PUBLIC_BUILD_ID) to notice a newer deployment.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
