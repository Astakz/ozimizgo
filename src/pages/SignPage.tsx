import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, ShieldCheck, PenLine, Download, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SignatureModal } from '@/components/sign/SignatureModal';
import { loadPdf } from '@/utils/pdfjsLoader';
import { finalizeSignedPdf, uint8ToBase64 } from '@/utils/pdfFinalize';
import type { SignField, FieldValueMap, SignatureRequestPublic } from '@/types/sign';
import { toast } from 'sonner';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-request`;
const AUTH_HEADER = { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };

export default function SignPage() {
  const { token } = useParams();
  const [req, setReq] = useState<SignatureRequestPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<{ pageNum: number; canvas: HTMLCanvasElement; pdfWidth: number; pdfHeight: number; scale: number }[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [values, setValues] = useState<FieldValueMap>({});
  const [signerName, setSignerName] = useState('');
  const [modalField, setModalField] = useState<SignField | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [done, setDone] = useState<{ signedAt: string; signatureId: string; blob: Blob } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const RENDER_SCALE = 1.6;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${token}`, { headers: AUTH_HEADER });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setErr(d.error === 'expired' ? 'This link has expired.' : 'Link not found or invalid.');
          setLoading(false); return;
        }
        const data: SignatureRequestPublic = await res.json();
        setReq(data);
        if (data.pdfUrl) {
          const pdfRes = await fetch(data.pdfUrl);
          const buf = await pdfRes.arrayBuffer();
          setPdfBytes(buf);
          const pdf = await loadPdf(buf.slice(0));
          const out = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const p = await pdf.getPage(i);
            const vp = p.getViewport({ scale: RENDER_SCALE });
            const canvas = document.createElement('canvas');
            canvas.width = vp.width; canvas.height = vp.height;
            await p.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp } as any).promise;
            const raw = p.getViewport({ scale: 1 });
            out.push({ pageNum: i, canvas, pdfWidth: raw.width, pdfHeight: raw.height, scale: RENDER_SCALE });
          }
          setPages(out);
        }
      } catch (e) {
        console.error(e); setErr('Failed to load document.');
      } finally { setLoading(false); }
    })();
  }, [token]);

  // scroll to first field
  useEffect(() => {
    if (!acknowledged || !req?.fields?.length) return;
    setTimeout(() => {
      const first = document.querySelector(`[data-field-id="${req.fields[0].id}"]`) as HTMLElement | null;
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }, [acknowledged, req]);

  const handleFieldClick = (f: SignField) => {
    if (f.type === 'signature' || f.type === 'initials') {
      setModalField(f);
    } else if (f.type === 'checkbox') {
      setValues((v) => ({ ...v, [f.id]: !v[f.id] }));
    } else if (f.type === 'date') {
      setValues((v) => ({ ...v, [f.id]: new Date().toLocaleDateString() }));
    }
  };

  const setFieldValue = (id: string, val: string) => setValues((v) => ({ ...v, [id]: val }));

  const allRequiredFilled = req?.fields.every((f) => !f.required || values[f.id]);

  const handleFinalize = async () => {
    if (!req || !pdfBytes) return;
    if (!allRequiredFilled) { toast.error('Please fill all required fields'); return; }
    if (!signerName.trim()) { toast.error('Please enter your name'); return; }
    setFinalizing(true);
    try {
      const bytes = await finalizeSignedPdf(pdfBytes.slice(0), req.fields, values, {
        documentId: req.id, signerName, signedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
      const base64 = uint8ToBase64(bytes);
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signedPdfBase64: base64, signerName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setDone({ signedAt: data.signedAt, signatureId: data.signatureId, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) });
    } catch (e: any) {
      console.error(e); toast.error(e.message || 'Failed to finalize');
    } finally { setFinalizing(false); }
  };

  const download = () => {
    if (!done) return;
    const url = URL.createObjectURL(done.blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${req?.title || 'signed'}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <FullScreen><Loader2 className="w-8 h-8 animate-spin text-primary" /></FullScreen>;
  if (err) return <FullScreen><Card className="p-8 max-w-md text-center rounded-3xl"><div className="text-4xl mb-3">⚠️</div><h2 className="text-xl font-semibold mb-2">Unavailable</h2><p className="text-muted-foreground">{err}</p></Card></FullScreen>;
  if (!req) return null;

  if (done) return (
    <FullScreen>
      <Card className="p-8 max-w-md w-full text-center rounded-3xl shadow-2xl border-0">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Document signed</h2>
        <p className="text-muted-foreground mb-6">Thank you! The document has been securely signed.</p>
        <div className="text-left bg-slate-50 rounded-2xl p-4 mb-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Signature ID</span><span className="font-mono text-xs truncate ml-2">{done.signatureId.slice(0, 12)}…</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Signed at</span><span>{new Date(done.signedAt).toLocaleString()}</span></div>
        </div>
        <Button onClick={download} className="w-full h-12 rounded-2xl"><Download className="w-4 h-4 mr-2" />Download signed PDF</Button>
      </Card>
    </FullScreen>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{req.title}</div>
              <div className="text-xs text-muted-foreground">{req.pageCount} pages · {(req.fileSize / 1024).toFixed(0)} KB</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {Object.keys(values).length}/{req.fields.length} fields
            </span>
            <Button
              disabled={!acknowledged || !allRequiredFilled || finalizing}
              onClick={handleFinalize}
              className="rounded-xl h-10 shadow-md"
            >
              {finalizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenLine className="w-4 h-4 mr-2" />}
              Finish
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-6 max-w-4xl">
        {!acknowledged && (
          <Card className="p-6 mb-6 rounded-3xl border-2 border-primary/20 bg-primary/5">
            <div className="flex gap-4">
              <ShieldCheck className="w-8 h-8 text-primary shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Before you sign</h3>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={acknowledged} onCheckedChange={(c) => setAcknowledged(Boolean(c))} className="mt-1" />
                  <span className="text-sm">I have read the document and understand its contents.</span>
                </label>
                <div className="mt-4">
                  <Input placeholder="Your full name" value={signerName} onChange={(e) => setSignerName(e.target.value)} className="rounded-xl h-11" />
                </div>
              </div>
            </div>
          </Card>
        )}

        <div ref={containerRef} className="space-y-4">
          {pages.map((p) => (
            <PagePreview
              key={p.pageNum}
              info={p}
              fields={req.fields.filter((f) => f.page === p.pageNum)}
              values={values}
              onClickField={handleFieldClick}
              onValue={setFieldValue}
              acknowledged={acknowledged}
            />
          ))}
        </div>
      </main>

      {modalField && (
        <SignatureModal
          open={!!modalField}
          onClose={() => setModalField(null)}
          format="png"
          legacy
          onSave={(res) => {
            const png = typeof res === 'string' ? res : res.dataUrl;
            setValues((v) => ({ ...v, [modalField.id]: png }));
            setModalField(null);
          }}
        />
      )}
    </div>
  );
}

function PagePreview({ info, fields, values, onClickField, onValue, acknowledged }: any) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [displayW, setDisplayW] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current!;
    wrap.querySelector('canvas')?.remove();
    wrap.prepend(info.canvas);
    info.canvas.style.width = '100%';
    info.canvas.style.height = 'auto';
    info.canvas.style.display = 'block';
    const update = () => setDisplayW(wrap.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update); ro.observe(wrap);
    return () => ro.disconnect();
  }, [info]);

  const dispScale = displayW / info.canvas.width;
  const pdfToDisp = dispScale * info.scale;

  return (
    <Card className="rounded-2xl overflow-hidden shadow-md border-0">
      <div className="px-4 py-2 bg-white dark:bg-card border-b text-xs font-medium">Page {info.pageNum}</div>
      <div ref={wrapRef} className="relative bg-slate-100">
        {fields.map((f: SignField) => {
          const val = values[f.id];
          const hasVal = val !== undefined && val !== null && val !== '' && val !== false;
          const dispX = f.x * pdfToDisp; const dispY = f.y * pdfToDisp;
          const dispW = f.w * pdfToDisp; const dispH = f.h * pdfToDisp;
          const isText = ['name', 'iin', 'email', 'phone', 'text'].includes(f.type);
          return (
            <div
              key={f.id}
              data-field-id={f.id}
              style={{ left: dispX, top: dispY, width: dispW, height: dispH }}
              className={`absolute rounded-md flex items-center justify-center overflow-hidden border-2 transition-all ${
                hasVal ? 'border-green-500 bg-green-50/60' : acknowledged
                  ? 'border-amber-400 bg-amber-100/70 animate-pulse cursor-pointer hover:bg-amber-200/70'
                  : 'border-slate-300 bg-slate-100/70'
              }`}
              onClick={() => acknowledged && !isText && onClickField(f)}
            >
              {f.type === 'signature' || f.type === 'initials' ? (
                hasVal ? <img src={val as string} className="max-w-full max-h-full object-contain" alt="sig" />
                       : <span className="text-xs text-amber-700 font-medium px-1">{f.label}</span>
              ) : f.type === 'checkbox' ? (
                <div className={`w-full h-full flex items-center justify-center ${hasVal ? 'text-green-600' : 'text-slate-400'}`}>
                  {hasVal ? '✓' : '☐'}
                </div>
              ) : isText ? (
                <input
                  type="text"
                  disabled={!acknowledged}
                  value={(val as string) || ''}
                  onChange={(e) => onValue(f.id, e.target.value)}
                  placeholder={f.label}
                  className="w-full h-full px-1 text-xs bg-transparent border-0 outline-none text-center"
                  style={{ fontSize: Math.max(10, dispH * 0.5) }}
                />
              ) : f.type === 'date' ? (
                <span className="text-xs px-1">{(val as string) || f.label}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-background p-4">{children}</div>;
}
