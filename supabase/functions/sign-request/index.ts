// Public endpoint for signing flow:
//  GET  ?token=xxx           -> returns request meta + signed URL for original PDF
//  POST { token, signedPdf } -> uploads signed PDF, marks request as signed
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ip = req.headers.get('x-forwarded-for') ?? '';
  const ua = req.headers.get('user-agent') ?? '';

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const token = url.searchParams.get('token');
      if (!token) return json({ error: 'token required' }, 400);

      const { data: reqs, error } = await supabase
        .from('signature_requests')
        .select('*')
        .eq('token', token)
        .maybeSingle();
      if (error || !reqs) return json({ error: 'not_found' }, 404);

      if (reqs.expires_at && new Date(reqs.expires_at) < new Date()) {
        await supabase.from('signature_requests').update({ status: 'expired' }).eq('id', reqs.id);
        return json({ error: 'expired' }, 410);
      }

      // Mark opened
      if (!reqs.opened_at) {
        await supabase.from('signature_requests').update({ opened_at: new Date().toISOString(), signer_ip: ip, signer_ua: ua }).eq('id', reqs.id);
        await supabase.from('signature_audit').insert({ request_id: reqs.id, event: 'opened', ip, user_agent: ua });
      }

      const { data: signed } = await supabase.storage
        .from('documents')
        .createSignedUrl(reqs.original_file_path, 3600);

      return json({
        id: reqs.id,
        title: reqs.title,
        pageCount: reqs.page_count,
        fileSize: reqs.file_size,
        fields: reqs.fields,
        status: reqs.status,
        expiresAt: reqs.expires_at,
        createdAt: reqs.created_at,
        pdfUrl: signed?.signedUrl ?? null,
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { token, signedPdfBase64, signerName } = body ?? {};
      if (!token || !signedPdfBase64) return json({ error: 'bad_request' }, 400);

      const { data: reqs, error } = await supabase
        .from('signature_requests').select('*').eq('token', token).maybeSingle();
      if (error || !reqs) return json({ error: 'not_found' }, 404);
      if (reqs.status === 'signed') return json({ error: 'already_signed' }, 409);
      if (reqs.expires_at && new Date(reqs.expires_at) < new Date()) return json({ error: 'expired' }, 410);

      const bin = Uint8Array.from(atob(signedPdfBase64), c => c.charCodeAt(0));
      const path = `${reqs.owner_id}/sign/signed_${reqs.id}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('documents').upload(path, bin, { contentType: 'application/pdf', upsert: true });
      if (upErr) return json({ error: 'upload_failed', detail: upErr.message }, 500);

      await supabase.from('signature_requests').update({
        signed_file_path: path,
        status: 'signed',
        signed_at: new Date().toISOString(),
        signer_name: signerName ?? reqs.signer_name,
        signer_ip: ip,
        signer_ua: ua,
      }).eq('id', reqs.id);

      await supabase.from('signature_audit').insert({
        request_id: reqs.id, event: 'signed', ip, user_agent: ua,
        metadata: { signer_name: signerName ?? null },
      });

      return json({ ok: true, signatureId: reqs.id, signedAt: new Date().toISOString() });
    }

    return json({ error: 'method_not_allowed' }, 405);
  } catch (e) {
    return json({ error: 'server_error', detail: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
