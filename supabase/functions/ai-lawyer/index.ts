import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 5;

const SYSTEM_PROMPTS: Record<string, string> = {
  kk: `Сен — Қазақстан Республикасының заңнамасы бойынша білікті AI заңгерсің. Пайдаланушы құжатын (мысалы, нотариустың атқарушы жазбасы, шарт, шағым) талдап, ҚР заңдарына сілтеме жасап, түсінікті әрі құрылымды кеңес бер. Жауапты қазақ тілінде, Markdown форматында бер: қысқа қорытынды, негізгі тәуекелдер, ұсынылатын әрекеттер, тиісті ҚР заң баптары. Заңды кеңес — ақпараттық сипатта, ресми құжат емес екенін ескерт.`,
  ru: `Ты — квалифицированный AI-юрист по законодательству Республики Казахстан. Проанализируй документ пользователя (например, исполнительную надпись нотариуса, договор, претензию) со ссылками на законы РК. Отвечай на русском в Markdown: краткий вывод, ключевые риски, рекомендуемые действия, релевантные статьи законов РК. Уточни, что консультация носит информационный характер.`,
  en: `You are an AI legal assistant specializing in the laws of the Republic of Kazakhstan. Analyze the user's document (e.g., notary writ of execution, contract, claim) with references to KZ legislation. Reply in English using Markdown: brief conclusion, key risks, recommended actions, relevant KZ law articles. Note that this is informational, not formal legal advice.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const question: string = (body.question ?? "").toString().trim();
    const documentText: string = (body.documentText ?? "").toString().trim();
    const language: string = ["kk", "ru", "en"].includes(body.language) ? body.language : "kk";

    if (!documentText && !question) {
      return new Response(JSON.stringify({ error: "Empty input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily limit check (UTC day)
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count, error: countErr } = await supabase
      .from("ai_consultations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString());

    if (countErr) console.error("count err", countErr);
    const used = count ?? 0;
    if (used >= DAILY_LIMIT) {
      return new Response(JSON.stringify({
        error: "daily_limit",
        used, limit: DAILY_LIMIT,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const truncatedDoc = documentText.slice(0, 12000);
    const userContent = [
      truncatedDoc ? `Құжат мәтіні / Document:\n"""\n${truncatedDoc}\n"""` : "",
      question ? `Сұрақ / Question: ${question}` : "Құжатты талда және кеңес бер. / Analyze the document and advise.",
    ].filter(Boolean).join("\n\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[language] },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "payment_required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const answer: string = aiJson.choices?.[0]?.message?.content ?? "";

    await supabase.from("ai_consultations").insert({
      user_id: user.id,
      question: question || "(құжатты талдау)",
      answer,
      document_excerpt: truncatedDoc.slice(0, 2000) || null,
      language,
    });

    return new Response(JSON.stringify({
      answer,
      used: used + 1,
      limit: DAILY_LIMIT,
      remaining: DAILY_LIMIT - used - 1,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-lawyer error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
