import { createClient } from "npm:@supabase/supabase-js@2";
const allowed = new Set(
  (Deno.env.get("APP_ORIGINS") ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((x) => x.trim()),
);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] =
    "authorization, apikey, content-type, x-client-info";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  if (origin && !allowed.has(origin))
    return new Response("Forbidden", { status: 403, headers });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers });
  try {
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer "))
      return new Response("Unauthorized", { status: 401, headers });
    const url = Deno.env.get("SUPABASE_URL")!;
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: auth, error: authError } = await user.auth.getUser();
    if (authError || !auth.user)
      return new Response("Unauthorized", { status: 401, headers });
    const { photoId } = await req.json();
    if (typeof photoId !== "string" || !/^[0-9a-f-]{36}$/i.test(photoId))
      return new Response("Invalid photo", { status: 400, headers });
    const { data: path, error } = await user.rpc("authorized_photo_path", {
      p_photo_id: photoId,
    });
    if (error || !path)
      return new Response("Not found", { status: 404, headers });
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: file, error: storageError } = await admin.storage
      .from("service-photos")
      .download(path);
    if (storageError || !file)
      return new Response("Not found", { status: 404, headers });
    headers["Content-Type"] = file.type || "application/octet-stream";
    return new Response(file, { headers });
  } catch {
    return new Response("Request failed", { status: 400, headers });
  }
});
