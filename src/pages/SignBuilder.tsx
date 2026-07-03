import { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, PenLine, Type, Calendar, Hash, Mail, Phone, CheckSquare, User, Trash2, Copy, Send, Loader2, Link as LinkIcon, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { loadPdf } from '@/utils/pdfjsLoader';
import type { SignField, SignFieldType } from '@/types/sign';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';

const FIELD_TYPES: { type: SignFieldType; label: string; icon: any; w: number; h: number }[] = [
  { type: 'signature', label: 'Signature', icon: PenLine, w: 180, h: 60 },
  { type: 'initials', label: 'Initials', icon: PenLine, w: 80, h: 40 },
  { type: 'name', label: 'Full name', icon: User, w: 200, h: 32 },
  { type: 'date', label: 'Date', icon: Calendar, w: 120, h: 32 },
  { type: 'iin', label: 'IIN', icon: Hash, w: 140, h: 32 },
  { type: 'email', label: 'Email', icon: Mail, w: 200, h: 32 },
  { type: 'phone', label: 'Phone', icon: Phone, w: 160, h: 32 },
  { type: 'text', label: 'Text', icon: Type, w: 200, h: 32 },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, w: 24, h: 24 },
];

const EXPIRY_OPTIONS = [
  { value: '3600', label: '1 hour' },
  { value: '43200', label: '12 hours' },
  { value: '86400', label: '24 hours' },
  { value: '259200', label: '3 days' },
  { value: '604800', label: '7 days' },
  { value: '2592000', label: '30 days' },
  { value: '0', label: 'No expiration' },
];

interface PageInfo { pageNum: number; canvas: HTMLCanvasElement; pdfWidth: number; pdfHeight: number; }

export default function SignBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [fields, setFields] = useState<SignField[]>([]);
  const [loading, setLoading] = useState(false);
  const [expiry, setExpiry] = useState('604800');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const pagesRef = useRef<Record<number, HTMLDivElement | null>>({});

  const RENDER_SCALE = 1.6;

  const handleFile = async (f: File) => {
    if (!f.type.includes('pdf')) { toast.error('Only PDF is supported in MVP'); return; }
    setFile(f);
    setTitle(f.name.replace(/\.pdf$/i, ''));
    setLoading(true);
    try {
      const buf = await f.arrayBuffer();
      const pdf = await loadPdf(buf.slice(0));
      const out: PageInfo[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        const raw = page.getViewport({ scale: 1 });
        out.push({ pageNum: i, canvas, pdfWidth: raw.width, pdfHeight: raw.height });
      }
      setPages(out);
      setFields([]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load PDF');
    } finally { setLoading(false); }
  };

  const onDropField = (e: React.DragEvent, pageNum: number) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('field-type') as SignFieldType;
    if (!type) return;
    const spec = FIELD_TYPES.find((f) => f.type === type)!;
    const page = pages.find((p) => p.pageNum === pageNum)!;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // click position in display px
    const dispX = e.clientX - rect.left;
    const dispY = e.clientY - rect.top;
    // convert display px -> PDF points (canvas rendered at RENDER_SCALE zoom)
    const displayW = rect.width;
    const scaleFactor = displayW / page.canvas.width; // display px per canvas px
    const canvasX = dispX / scaleFactor;
    const canvasY = dispY / scaleFactor;
    const pdfX = canvasX / RENDER_SCALE;
    const pdfY = canvasY / RENDER_SCALE;
    setFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type, page: pageNum, x: pdfX, y: pdfY, w: spec.w, h: spec.h, required: true, label: spec.label },
    ]);
  };

  const removeField = (id: string) => setFields((s) => s.filter((f) => f.id !== id));

  const generateToken = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(48)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

  const handleSend = async () => {
    if (!file || !user || !title.trim() || !fields.length) {
      toast.error('Add fields and title first');
      return;
    }
    setLoading(true);
    try {
      const id = crypto.randomUUID();
      const path = `${user.id}/sign/${id}.pdf`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { contentType: 'application/pdf' });
      if (upErr) throw upErr;
      const token = generateToken();
      const expSec = parseInt(expiry, 10);
      const expiresAt = expSec > 0 ? new Date(Date.now() + expSec * 1000).toISOString() : null;
      const { error } = await supabase.from('signature_requests').insert({
        id, owner_id: user.id, title: title.trim(),
        original_file_path: path,
        page_count: pages.length, file_size: file.size,
        token, status: 'sent', expires_at: expiresAt,
        fields: fields as any,
      } as any);
      if (error) throw error;
      await supabase.from('signature_audit').insert({ request_id: id, event: 'created' });
      const url = `${window.location.origin}/sign/${token}`;
      setShareUrl(url);
      setShareOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to create link');
    } finally { setLoading(false); }
  };

  const copyLink = () => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied'); };
  const shareWA = () => window.open(`https://wa.me/?text=${encodeURIComponent('Please sign: ' + shareUrl)}`);
  const shareTG = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Please sign')}`);
  const shareEmail = () => window.open(`mailto:?subject=${encodeURIComponent('Signature request')}&body=${encodeURIComponent('Please sign: ' + shareUrl)}`);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {!file ? (
          <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                <PenLine className="w-3.5 h-3.5" /> E-Signature · Premium
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">Send document for signature</h1>
              <p className="text-muted-foreground">Upload a PDF, place fields, share a secure link.</p>
            </div>
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-primary/30 hover:border-primary transition-colors rounded-3xl p-12 text-center bg-white dark:bg-card">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <p className="font-semibold text-lg">Drop PDF here or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">Maximum 20 MB</p>
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            </label>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[280px_1fr] gap-4 sm:gap-6">
            {/* Sidebar */}
            <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)] flex flex-col gap-4">
              <Card className="p-4 rounded-2xl">
                <Label className="text-xs text-muted-foreground">Document title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 rounded-xl" />
              </Card>
              <Card className="p-4 rounded-2xl flex-1 overflow-auto">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Drag fields to page</div>
                <div className="grid grid-cols-2 gap-2">
                  {FIELD_TYPES.map((f) => (
                    <div
                      key={f.type}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('field-type', f.type)}
                      className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-100 dark:bg-muted hover:bg-primary/10 border border-transparent hover:border-primary/30 cursor-grab active:cursor-grabbing transition-all"
                    >
                      <f.icon className="w-4 h-4 text-primary" />
                      <span className="text-xs">{f.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-xs text-muted-foreground">Link expires in</Label>
                  <Select value={expiry} onValueChange={setExpiry}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPIRY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </Card>
              <Button onClick={handleSend} disabled={loading || !fields.length} className="w-full h-12 rounded-2xl text-base shadow-lg">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Create signing link
              </Button>
            </aside>

            {/* Pages */}
            <div className="space-y-4">
              {pages.map((p) => (
                <PageCanvas
                  key={p.pageNum}
                  info={p}
                  fields={fields.filter((f) => f.page === p.pageNum)}
                  onDropField={(e) => onDropField(e, p.pageNum)}
                  onRemove={removeField}
                  onMove={(id, dx, dy) => {
                    setFields((prev) => prev.map((f) => f.id === id ? { ...f, x: f.x + dx, y: f.y + dy } : f));
                  }}
                  onResize={(id, w, h) => {
                    setFields((prev) => prev.map((f) => f.id === id ? { ...f, w, h } : f));
                  }}
                  renderScale={RENDER_SCALE}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur">
              <LinkIcon className="w-7 h-7" />
            </div>
            <DialogTitle className="text-2xl text-primary-foreground">Ready to sign</DialogTitle>
            <p className="text-primary-foreground/80 text-sm mt-1">Share this secure link with the signer</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-2xl border">
              {shareUrl && <QRCodeSVG value={shareUrl} size={180} level="M" />}
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-muted rounded-xl">
              <div className="flex-1 text-xs font-mono truncate">{shareUrl}</div>
              <Button size="sm" variant="ghost" onClick={copyLink}><Copy className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={shareWA} className="rounded-xl h-11"><MessageCircle className="w-4 h-4 mr-1" />WhatsApp</Button>
              <Button variant="outline" onClick={shareTG} className="rounded-xl h-11">Telegram</Button>
              <Button variant="outline" onClick={shareEmail} className="rounded-xl h-11"><Mail className="w-4 h-4 mr-1" />Email</Button>
            </div>
            <Button className="w-full h-11 rounded-xl" onClick={() => navigate('/sign-requests')}>Go to my requests</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

function PageCanvas({
  info, fields, onDropField, onRemove, onMove, onResize, renderScale,
}: {
  info: PageInfo;
  fields: SignField[];
  onDropField: (e: React.DragEvent) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  renderScale: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [displayW, setDisplayW] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current!;
    // insert canvas
    wrap.querySelector('canvas')?.remove();
    wrap.prepend(info.canvas);
    info.canvas.style.width = '100%';
    info.canvas.style.height = 'auto';
    info.canvas.style.display = 'block';
    const update = () => setDisplayW(wrap.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [info]);

  const dispScale = displayW / info.canvas.width; // display px per canvas px
  const pdfToDisp = dispScale * renderScale;

  return (
    <Card className="rounded-2xl overflow-hidden shadow-md border-0">
      <div className="px-4 py-2 bg-white dark:bg-card border-b flex items-center justify-between text-xs">
        <span className="font-medium">Page {info.pageNum}</span>
        <span className="text-muted-foreground">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
      </div>
      <div
        ref={wrapRef}
        className="relative bg-slate-100"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropField}
      >
        {fields.map((f) => (
          <DraggableField
            key={f.id}
            field={f}
            pdfToDisp={pdfToDisp}
            onRemove={() => onRemove(f.id)}
            onMoveEnd={(dx, dy) => onMove(f.id, dx / pdfToDisp, dy / pdfToDisp)}
            onResizeEnd={(w, h) => onResize(f.id, w / pdfToDisp, h / pdfToDisp)}
          />
        ))}
      </div>
    </Card>
  );
}

function DraggableField({
  field, pdfToDisp, onRemove, onMoveEnd, onResizeEnd,
}: {
  field: SignField;
  pdfToDisp: number;
  onRemove: () => void;
  onMoveEnd: (dx: number, dy: number) => void;
  onResizeEnd: (w: number, h: number) => void;
}) {
  const [drag, setDrag] = useState<{ sx: number; sy: number; dx: number; dy: number } | null>(null);
  const [resize, setResize] = useState<{ sx: number; sy: number; w: number; h: number } | null>(null);

  const dispW = field.w * pdfToDisp;
  const dispH = field.h * pdfToDisp;
  const dispX = field.x * pdfToDisp + (drag?.dx || 0);
  const dispY = field.y * pdfToDisp + (drag?.dy || 0);
  const showW = resize?.w ?? dispW;
  const showH = resize?.h ?? dispH;

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.role === 'resize' || (e.target as HTMLElement).dataset.role === 'remove') return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ sx: e.clientX, sy: e.clientY, dx: 0, dy: 0 });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (drag) setDrag({ ...drag, dx: e.clientX - drag.sx, dy: e.clientY - drag.sy });
    if (resize) setResize({ ...resize, w: Math.max(30, resize.w + (e.clientX - resize.sx)), h: Math.max(20, resize.h + (e.clientY - resize.sy)) });
    if (resize) setResize((r) => r ? { ...r, sx: e.clientX, sy: e.clientY } : r);
  };
  const endDrag = () => {
    if (drag) { onMoveEnd(drag.dx, drag.dy); setDrag(null); }
    if (resize) { onResizeEnd(resize.w, resize.h); setResize(null); }
  };

  return (
    <div
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ left: dispX, top: dispY, width: showW, height: showH }}
      className="absolute group border-2 border-primary bg-primary/10 hover:bg-primary/15 rounded-md cursor-move flex items-center justify-center text-primary text-xs font-medium select-none touch-none"
    >
      <span className="pointer-events-none px-1 truncate">{field.label}{field.required && ' *'}</span>
      <button
        data-role="remove"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
      >
        <Trash2 className="w-3 h-3" />
      </button>
      <div
        data-role="resize"
        onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setResize({ sx: e.clientX, sy: e.clientY, w: dispW, h: dispH }); }}
        className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-sm cursor-nwse-resize"
      />
    </div>
  );
}
