import { redirect, notFound } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { Application } from "@/components/application";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { path = [] } = await params;
  const query = await searchParams;
  const route = "/" + path.join("/");
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const allowDemo =
    process.env.NEXT_PUBLIC_ENABLE_DEMO === "true" ||
    (process.env.NODE_ENV === "development" && !configured);
  const demo = allowDemo && query.demo === "1";
  const known =
    route === "/" ||
    [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/admin",
      "/admin/customers",
      "/admin/vehicles",
      "/admin/records",
      "/admin/design",
      "/my/vehicles",
    ].includes(route) ||
    /^\/(invite\/[^/]+|admin\/(customers|vehicles|records)\/[^/]+(?:\/(?:preview|transfer))?|my\/(vehicles|records)\/[^/]+)$/.test(
      route,
    );
  if (!known) notFound();
  if (configured && !demo) {
    const client = await serverSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    const isPublic =
      ["/login", "/signup", "/forgot-password", "/reset-password"].includes(
        route,
      ) || route.startsWith("/invite/");
    if (route === "/" && user) {
      const { data: admin } = await client.rpc("is_admin");
      redirect(admin ? "/admin" : "/my/vehicles");
    }
    if (!user && !isPublic && route !== "/") redirect("/login");
    if (user && route.startsWith("/admin")) {
      const { data: admin } = await client.rpc("is_admin");
      if (!admin) redirect("/my/vehicles");
    }
  }
  return (
    <Application
      route={route}
      demo={demo}
      configured={configured}
      allowDemo={allowDemo}
    />
  );
}
