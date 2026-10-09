import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function reply(status: number, result: Record<string, unknown>) {
  return new Response(JSON.stringify(result), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (Number(request.headers.get("content-length") || "0") > 2048) {
    return reply(413, { error: "Request too large" });
  }
  // Never permit browsers to read these private responses. No CORS headers.
  const bearer = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(request.headers.get("authorization") || "");
  if (!bearer) return reply(401, { error: "Not authorized" });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(503, { error: "Service unavailable" });
  let data: Record<string, unknown>;
  try {
    data = await request.json();
    if (!data || typeof data !== "object") throw new Error("Invalid body");
  } catch {
    return reply(400, { error: "Malformed JSON" });
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = bearer[1];
  if (data.action === "claim") {
    const { data: rows, error } = await admin.rpc("whatsapp_worker_claim", {
      p_token: token,
      p_limit: 3,
    });
    if (error) return reply(error.code === "42501" ? 401 : 503, { error: "Worker unavailable" });
    return reply(200, { jobs: rows || [] });
  }
  if (data.action === "ack") {
    const id = typeof data.id === "string" ? data.id : "";
    const lease = typeof data.lease === "string" ? data.lease : "";
    const success = data.success === true;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(lease)) {
      return reply(400, { error: "Invalid receipt" });
    }
    const { data: ack, error } = await admin.rpc("whatsapp_worker_ack", {
      p_token: token,
      p_id: id,
      p_lease: lease,
      p_success: success,
      p_error: success ? null : String(data.error || "Delivery failed").slice(0, 200),
    });
    if (error) return reply(error.code === "42501" ? 401 : 503, { error: "Unable to acknowledge" });
    return reply(200, { acknowledged: ack === true });
  }
  return reply(400, { error: "Unsupported action" });
});
