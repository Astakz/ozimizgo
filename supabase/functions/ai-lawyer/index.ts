import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_DAILY_LIMIT = 5;

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
    const language: string = ["kk", "ru", "en", "auto"].includes(body.language) ? body.language : "kk";
    const allowedModes = ["consult", "generate", "chat"];
    const mode: string = allowedModes.includes(body.mode) ? body.mode : "consult";
    const docType: string = (body.docType ?? "").toString();
    const fields = (body.fields ?? {}) as Record<string, string>;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (mode === "consult" && !documentText && !question) {
      return new Response(JSON.stringify({ error: "Empty input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (mode === "chat" && messages.length === 0) {
      return new Response(JSON.stringify({ error: "Empty messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (mode === "generate" && !docType) {
      return new Response(JSON.stringify({ error: "Missing docType" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load user AI access settings
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("ai_daily_limit, ai_unlimited_access, ai_unlimited_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profErr) console.error("profile err", profErr);

    let unlimited = !!profile?.ai_unlimited_access;
    const unlimitedExp = profile?.ai_unlimited_expires_at ? new Date(profile.ai_unlimited_expires_at) : null;

    // Auto-expire unlimited access
    if (unlimited && unlimitedExp && unlimitedExp.getTime() <= Date.now()) {
      unlimited = false;
      await supabase
        .from("profiles")
        .update({ ai_unlimited_access: false, ai_unlimited_expires_at: null })
        .eq("user_id", user.id);
    }

    const dailyLimit = typeof profile?.ai_daily_limit === "number" ? profile.ai_daily_limit : DEFAULT_DAILY_LIMIT;

    // Daily used count (UTC day) — auto-resets at 00:00 UTC
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count, error: countErr } = await supabase
      .from("ai_consultations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString());

    if (countErr) console.error("count err", countErr);
    const used = count ?? 0;

    if (!unlimited && used >= dailyLimit) {
      return new Response(JSON.stringify({
        error: "daily_limit",
        used, limit: dailyLimit, unlimited: false,
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

    const CHAT_SYSTEM: Record<string, string> = {
      kk: `Сен — Қазақстан Республикасының заңнамасы бойынша маманданған, тірі заңгер сияқты сөйлесетін AI-заңгерсің. Тек қазақ тілінде жауап бер.

ЖҰМЫС АЛГОРИТМІ:
1) Пайдаланушының бірінші хабарламасынан оның заңдық мәселесін анықта (мысалы: коллекторға шағым, атқарушылық жазбаға қарсылық, сотқа арыз, өтініш т.б.). Қажет болса, нақтылау сұрағын қой.
2) Ресми құжатты рәсімдеу үшін қажетті деректерді (Аты-жөні, ИИН, телефон, мекенжай, жеке куәлік нөмірі мен берілген күні, қарсы тараптың атауы мен деректемелері, оқиға мән-жайы, сома, күндер, т.б.) пайдаланушыдан БІРДЕН СҰРАМА. Бір хабарламада 1-2 деректі ғана сыпайы түрде кезек-кезек сұрап отыр. Пайдаланушы сұраққа толық жауап бермесе, келесі сұраққа көшпе — сол деректі нақтыла.
3) Барлық қажетті деректер жиналған кезде, ҚР заң баптарына сүйене отырып ресми стильде дайын құжаттың ТОЛЫҚ МӘТІНІН шығар. Дайын құжатты МІНДЕТТІ түрде мынадай белгілермен орап жібер:
===DOCUMENT_START===
(құжаттың толық мәтіні; жоғарғы оң жақта адресат пен арыз иесі, ортасында ҮЛКЕН ӘРІПТЕРМЕН тақырып, мотивтеу бөлімінде ҚР заңдарына сілтемелер, "СҰРАЙМЫН" бөлімі, қосымшалар тізімі, күні және "Қолы: ____________" жолы)
===DOCUMENT_END===

ЕРЕЖЕЛЕР:
- Өзіңді құрғақ робот сияқты ұстама, сыпайы әрі көмектесуге дайын заңгер рөлінде бол.
- Жауапта ешқандай батырмалар, нұсқаулар немесе кодтар ұсынба, тек қалыпты мәтінмен сөйлес.
- Құжатты ерте шығарма — мәліметтер жеткілікті болғанда ғана. Әйтпесе келесі сұрақты қой.
- Сұхбат соңында пайдаланушы құжатты PDF не DOC форматта жүктеп алады және қол қою орнын өзі қалаған жерге жылжыта алады — мұны еске сал.`,
      ru: `Ты — AI-юрист по законодательству Республики Казахстан, общающийся как живой юрист. Отвечай только на русском языке.

АЛГОРИТМ РАБОТЫ:
1) По первому сообщению определи юридическую проблему пользователя (жалоба на коллектора, возражение на исполнительную надпись, иск в суд, заявление и т.п.). При необходимости задай уточняющий вопрос.
2) Для оформления официального документа НЕ запрашивай сразу все данные. В одном сообщении вежливо спрашивай только 1-2 сведения по очереди (ФИО, ИИН, телефон, адрес, номер и дата выдачи удостоверения личности, реквизиты второй стороны, обстоятельства, суммы, даты и т.д.). Если пользователь ответил не полностью — уточни именно это поле, не переходи к следующему.
3) Когда все необходимые данные собраны, составь полный ОФИЦИАЛЬНЫЙ текст документа со ссылками на конкретные статьи законов РК. ОБЯЗАТЕЛЬНО оберни готовый документ маркерами:
===DOCUMENT_START===
(полный текст документа: справа вверху адресат и данные заявителя, по центру ЗАГОЛОВОК ЗАГЛАВНЫМИ, мотивировочная часть со ссылками на законы РК, раздел «ПРОШУ», перечень приложений, дата и строка «Подпись: ____________»)
===DOCUMENT_END===

ПРАВИЛА:
- Не будь сухим роботом — веди себя как вежливый и помогающий юрист.
- В ответах никаких кнопок, инструкций или кода — только обычный текст.
- Не выдавай документ преждевременно — только когда данных достаточно, иначе задай следующий вопрос.
- В конце напомни, что пользователь сможет скачать документ в PDF или DOC и переместить место подписи в любое удобное место.`,
      en: `You are an AI lawyer specialized in the laws of the Republic of Kazakhstan, speaking like a real lawyer. Reply only in English.

WORKFLOW:
1) From the first message identify the user's legal issue (complaint against collector, objection to notary writ, court claim, application, etc.). Ask a clarifying question if needed.
2) Do NOT ask for all required data at once. In each message politely ask for only 1-2 pieces of information in turn (full name, IIN, phone, address, ID number and date of issue, opposing party details, circumstances, amounts, dates, etc.). If the user answers incompletely, follow up on that same field before moving on.
3) When you have all required data, draft the full OFFICIAL document text with references to specific RK law articles. ALWAYS wrap the ready document with markers:
===DOCUMENT_START===
(full document: addressee and applicant on the top right, centered TITLE IN CAPS, reasoning with RK law references, a "REQUEST" section, attachments list, date, and a "Signature: ____________" line)
===DOCUMENT_END===

RULES:
- Don't sound like a dry robot — behave like a polite, helpful lawyer.
- No buttons, code blocks or system-style instructions in your replies — plain text only.
- Don't produce the document prematurely — only when enough data is collected, otherwise ask the next question.
- At the end remind the user they can download the document as PDF or DOC and freely move the signature placement.`,
    };

    CHAT_SYSTEM.auto = `You are an AI lawyer specialized in the laws of the Republic of Kazakhstan, behaving like a real, polite lawyer.

LANGUAGE RULE (CRITICAL):
- Detect the language of the user's LAST message automatically.
- If the user wrote in Kazakh — reply ONLY in Kazakh.
- If the user wrote in Russian — reply ONLY in Russian.
- If the user wrote in English — reply ONLY in English.
- Only reply in two languages if the user explicitly asks for a bilingual answer.
- Always cite the legislation of the Republic of Kazakhstan.

WORKFLOW:
1) From the user's first message identify the legal issue (objection to notary writ, complaint against a collector, court claim, application, etc.). Ask a clarifying question if needed.
2) If the user attached a document, its OCR/extracted text is included in their message after a marker. Read it, analyze it, and base your answer on its actual content.
3) Do NOT ask for all required data at once. In each message politely request only 1-2 pieces of info in turn (full name, IIN, phone, address, ID number and issue date, opposing party details, circumstances, amounts, dates, etc.). If the user answered incompletely, follow up on that same field before moving on.
4) When you have all required data and the user asks for a document, draft the full OFFICIAL text with references to specific RK law articles, wrapped with markers exactly:
===DOCUMENT_START===
(full document: addressee and applicant top-right, centered TITLE IN CAPS, reasoning with RK law references, a request section, attachments list, date and a signature line)
===DOCUMENT_END===

RULES:
- Be warm and professional, not a dry robot.
- Plain text only — no buttons, no code blocks, no system-style instructions.
- Don't produce the document prematurely.
- Remind the user at the end that they can download the document as PDF or DOC and freely move the signature placement.`;


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

    const systemPrompt = mode === "generate"
      ? GENERATE_SYSTEM[language]
      : mode === "chat"
        ? CHAT_SYSTEM[language]
        : SYSTEM_PROMPTS[language];

    const chatMessages = mode === "chat"
      ? [
          { role: "system", content: systemPrompt },
          ...messages
            .filter((m: any) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
            .slice(-30)
            .map((m: any) => ({ role: m.role, content: m.content })),
        ]
      : [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
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

    const logQuestion = mode === "generate"
      ? `[GENERATE] ${docType}`
      : mode === "chat"
        ? `[CHAT] ${(messages[messages.length - 1]?.content ?? "").toString().slice(0, 500)}`
        : (question || "(құжатты талдау)");

    await supabase.from("ai_consultations").insert({
      user_id: user.id,
      question: logQuestion,
      answer,
      document_excerpt: truncatedDoc.slice(0, 2000) || null,
      language,
    });

    return new Response(JSON.stringify({
      answer,
      used: used + 1,
      limit: dailyLimit,
      remaining: unlimited ? null : Math.max(0, dailyLimit - used - 1),
      unlimited,
      unlimitedExpiresAt: unlimited && unlimitedExp ? unlimitedExp.toISOString() : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-lawyer error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
