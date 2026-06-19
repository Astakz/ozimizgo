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
    const mode: string = body.mode === "generate" ? "generate" : "consult";
    const docType: string = (body.docType ?? "").toString();
    const fields = (body.fields ?? {}) as Record<string, string>;

    if (mode === "consult" && !documentText && !question) {
      return new Response(JSON.stringify({ error: "Empty input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (mode === "generate" && !docType) {
      return new Response(JSON.stringify({ error: "Missing docType" }), {
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

    const DOC_TYPE_LABELS: Record<string, string> = {
      objection_executive: "Возражение на исполнительную надпись нотариуса",
      restructuring: "Заявление о реструктуризации задолженности",
      penalty_reduction: "Заявление об уменьшении неустойки (пени)",
      collector_complaint: "Жалоба на действия коллекторского агентства",
      financial_complaint: "Жалоба в финансовую организацию (банк/МФО)",
      court_claim: "Исковое заявление в суд",
    };

    const GENERATE_SYSTEM: Record<string, string> = {
      kk: `Сен — ҚР заңнамасы бойынша білікті заңгерсің. Пайдаланушы берген деректер негізінде толық, ресми, дайын ҚҰЖАТ мәтінін жаз. Жауапта тек құжаттың өзін бер (түсініктемесіз, markdown белгілерсіз). Құрылым: жоғарғы оң жақта адресат пен арыз иесінің деректері, ортасында тақырып бас әріптермен, дәлелдеу бөлімінде ҚР заң баптарына нақты сілтемелер, төменде сұраныс ("СҰРАЙМЫН"), қосымшалар тізімі, күні мен қол қою орны. Жетіспейтін деректерді [квадрат жақшаға] қой.`,
      ru: `Ты — квалифицированный юрист по законодательству РК. На основе данных пользователя составь полный, официальный, готовый к подаче ДОКУМЕНТ. В ответе верни только сам документ без пояснений и markdown-разметки. Структура: справа вверху — адресат и данные заявителя; по центру — заголовок ЗАГЛАВНЫМИ; мотивировочная часть со ссылками на конкретные статьи законов РК; «ПРОШУ»; перечень приложений; дата и место для подписи. Недостающие данные оставляй в [квадратных скобках].`,
      en: `You are a qualified lawyer in Kazakhstan law. Based on the user's data, draft a complete, official, ready-to-file DOCUMENT. Return only the document text, no markdown, no commentary. Structure: top-right addressee and applicant data, centered title in CAPS, reasoning with specific references to RK law articles, a "REQUEST" section, list of attachments, date and signature line. Put missing data in [square brackets].`,
    };

    const fieldsText = Object.entries(fields)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    const userContent = mode === "generate"
      ? `Құжат түрі / Тип документа: ${DOC_TYPE_LABELS[docType] ?? docType}\n\nДанные заявителя:\n${fieldsText || "(нет)"}\n\n${truncatedDoc ? `Доп. контекст:\n"""\n${truncatedDoc}\n"""` : ""}`
      : [
          truncatedDoc ? `Құжат мәтіні / Document:\n"""\n${truncatedDoc}\n"""` : "",
          question ? `Сұрақ / Question: ${question}` : "Құжатты талда және кеңес бер. / Analyze the document and advise.",
        ].filter(Boolean).join("\n\n");

    const systemPrompt = mode === "generate" ? GENERATE_SYSTEM[language] : SYSTEM_PROMPTS[language];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
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
