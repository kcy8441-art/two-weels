import { createBrowserClient } from "@supabase/ssr";
export const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
export const demoEnabled =
  process.env.NEXT_PUBLIC_ENABLE_DEMO === "true" ||
  (process.env.NODE_ENV === "development" && !configured);
let client: ReturnType<typeof createBrowserClient> | undefined;
export function supabase() {
  if (!configured) throw new Error("Supabase 연결 설정이 필요합니다.");
  return (client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  ));
}
