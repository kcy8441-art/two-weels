import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/domain";
export async function GET(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return NextResponse.redirect(new URL("/login", request.url));
  const token = request.nextUrl.searchParams.get("token_hash");
  const code = request.nextUrl.searchParams.get("code");
  const type = request.nextUrl.searchParams.get("type");
  const supabase = await serverSupabase();
  if (token && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "recovery",
    });
    if (!error)
      return NextResponse.redirect(new URL("/reset-password", request.url));
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === "recovery"
            ? "/reset-password"
            : safeNext(request.nextUrl.searchParams.get("next")),
          request.url,
        ),
      );
  }
  return NextResponse.redirect(new URL("/login?error=recovery", request.url));
}
