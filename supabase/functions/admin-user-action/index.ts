// Admin user management edge function: delete users hard (auth + profile)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action, target_user_id, blocked_until, reason } = body as {
      action: "delete" | "block" | "unblock";
      target_user_id: string;
      blocked_until?: string | null;
      reason?: string | null;
    };

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (target_user_id === user.id) {
      return new Response(JSON.stringify({ error: "Cannot act on yourself" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      // Hard delete: profile cascade may not exist, so delete profile then auth user
      await admin.from("profiles").delete().eq("user_id", target_user_id);
      await admin.from("user_roles").delete().eq("user_id", target_user_id);
      const { error: delErr } = await admin.auth.admin.deleteUser(target_user_id);
      if (delErr) throw delErr;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "block") {
      if (!blocked_until) {
        return new Response(JSON.stringify({ error: "blocked_until required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: upErr } = await admin.from("profiles").update({
        blocked_until,
        blocked_reason: reason ?? null,
        blocked_at: new Date().toISOString(),
      }).eq("user_id", target_user_id);
      if (upErr) throw upErr;
      // Sign out current sessions for this user
      try { await admin.auth.admin.signOut(target_user_id); } catch (_e) { /* ignore */ }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "unblock") {
      const { error: upErr } = await admin.from("profiles").update({
        blocked_until: null,
        blocked_reason: null,
        blocked_at: null,
      }).eq("user_id", target_user_id);
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
