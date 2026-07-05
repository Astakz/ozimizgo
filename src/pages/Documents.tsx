import { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Upload, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCw, PenLine,
  Download, Send, FileText, Loader2, ChevronLeft, ChevronRight, Trash2, ImageIcon,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { renderDocument, detectKind, type RenderedPage } from '@/utils/documentLoader';
import { SignatureModal } from '@/components/sign/SignatureModal';
import { PlacedSignature, type PlacedSig } from '@/components/documents/PlacedSignature';
import { exportToPdf, exportPageToImage, downloadBlob } from '@/utils/pdfExport';

export default function Documents() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [sigs, setSigs] = useState<PlacedSig[]>([]);
  const [selectedSig, setSelectedSig] = useState<string | null>(null);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleFile = async (f: File) => {
    const kind = detectKind(f);
    if (kind === 'unknown') { toast.error('Unsupported file type'); return; }
    if (f.size > 25 * 1024 * 1024) { toast.error('File too large (max 25MB)'); return; }
    setLoading(true); setFile(f); setSigs([]); setCurrentPage(1); setZoom(1); setRotation(0);
    try {
      const rendered = await renderDocument(f);
      setPages(rendered);
      toast.success(`Loaded ${rendered.length} page${rendered.length !== 1 ? 's' : ''}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to open document');
      setFile(null);
    } finally { setLoading(false); }
  };

  const goToPage = (n: number) => {
    setCurrentPage(n);
    pageRefs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Track visible page on scroll
  useEffect(() => {
    if (!pages.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const n = parseInt((visible[0].target as HTMLElement).dataset.page || '1', 10);
          setCurrentPage(n);
        }
      },
      { root: scrollRef.current, threshold: [0.3, 0.6] },
    );
    Object.values(pageRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [pages]);

  const onSignatureSave = (res: any) => {
    setSigModalOpen(false);
    const page = pages.find((p) => p.pageNum === currentPage) || pages[0];
    if (!page) return;
    const dataUrl: string = typeof res === 'string' ? res : res.dataUrl;
    const natW: number = typeof res === 'object' && res.naturalWidth ? res.naturalWidth : 100;
    const natH: number = typeof res === 'object' && res.naturalHeight ? res.naturalHeight : 35;
    const aspect = natH / natW;
    const w = page.width * 0.28;
    const h = w * aspect;
    const id = crypto.randomUUID();
    setSigs((s) => [
      ...s,
      { id, pageNum: page.pageNum, x: (page.width - w) / 2, y: (page.height - h) / 2, w, h, rotation: 0, dataUrl },
    ]);
    setSelectedSig(id);
    toast.success('Signature added — drag to position');
  };

  const download = async (format: 'pdf' | 'png' | 'jpg') => {
    if (!pages.length) return;
    setSaving(true);
    try {
      const base = file?.name?.replace(/\.[^.]+$/, '') || 'document';
      if (format === 'pdf') {
        const bytes = await exportToPdf(pages, sigs);
        downloadBlob(bytes, `${base}-signed.pdf`, 'application/pdf');
      } else {
        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const page = pages.find((p) => p.pageNum === currentPage)!;
        const blob = await exportPageToImage(page, sigs, mime as any);
        downloadBlob(blob, `${base}-p${currentPage}.${format}`, mime);
      }
      toast.success('Downloaded');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to save');
    } finally { setSaving(false); }
  };

  const reset = () => { setFile(null); setPages([]); setSigs([]); };

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-background ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {!fullscreen && <Header />}
      <main className="flex-1 flex flex-col">
        {!file ? (
          <UploadPanel onFile={handleFile} loading={loading} onSendToOther={() => navigate('/sign-builder')} />
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="border-b bg-white dark:bg-card sticky top-0 z-40 shadow-sm">
              <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 overflow-x-auto">
                <Button variant="ghost" size="sm" onClick={reset} className="shrink-0">
                  <ChevronLeft className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">New</span>
                </Button>
                <div className="w-px h-6 bg-border shrink-0" />
                <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
                <div className="text-xs font-medium tabular-nums w-12 text-center shrink-0">{Math.round(zoom * 100)}%</div>
                <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setZoom(1)} title="Fit"><Maximize2 className="w-4 h-4" /></Button>
                <div className="w-px h-6 bg-border shrink-0" />
                <Button variant="ghost" size="icon" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw className="w-4 h-4" /></Button>
                <div className="w-px h-6 bg-border shrink-0" />
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="text-xs font-medium tabular-nums whitespace-nowrap">{currentPage} / {pages.length}</div>
                  <Button variant="ghost" size="icon" onClick={() => goToPage(Math.min(pages.length, currentPage + 1))} disabled={currentPage >= pages.length}><ChevronRight className="w-4 h-4" /></Button>
                </div>
                <div className="flex-1" />
                <Button size="sm" variant="outline" onClick={() => setFullscreen((f) => !f)} className="shrink-0 hidden sm:inline-flex">
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button size="sm" onClick={() => setSigModalOpen(true)} className="shrink-0 gap-1 bg-gradient-to-r from-primary to-primary/80">
                  <PenLine className="w-4 h-4" /><span className="hidden sm:inline">Sign</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary" className="shrink-0 gap-1" disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span className="hidden sm:inline">Save</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => download('pdf')}><FileText className="w-4 h-4 mr-2" />PDF (all pages)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => download('png')}><ImageIcon className="w-4 h-4 mr-2" />PNG (current page)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => download('jpg')}><ImageIcon className="w-4 h-4 mr-2" />JPG (current page)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" variant="outline" onClick={() => navigate('/sign-builder')} className="shrink-0 gap-1 hidden md:inline-flex">
                  <Send className="w-4 h-4" /> Send to signer
                </Button>
              </div>
            </div>

            <div className="flex-1 flex min-h-0">
              {/* Thumbnails */}
              <aside className="hidden md:flex flex-col w-32 border-r bg-white dark:bg-card overflow-y-auto p-2 gap-2">
                {pages.map((p) => (
                  <button
                    key={p.pageNum}
                    onClick={() => goToPage(p.pageNum)}
                    className={`relative rounded-lg overflow-hidden border-2 transition ${currentPage === p.pageNum ? 'border-primary shadow-md' : 'border-transparent hover:border-primary/40'}`}
                  >
                    <ThumbnailCanvas source={p.canvas} />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-0.5 text-center">{p.pageNum}</div>
                  </button>
                ))}
              </aside>

              {/* Pages viewport */}
              <div ref={scrollRef} className="flex-1 overflow-auto p-3 sm:p-6" onClick={() => setSelectedSig(null)}>
                <div className="flex flex-col items-center gap-4 sm:gap-6">
                  {pages.map((p) => (
                    <PageView
                      key={p.pageNum}
                      page={p}
                      zoom={zoom}
                      rotation={rotation}
                      sigs={sigs.filter((s) => s.pageNum === p.pageNum)}
                      selectedSig={selectedSig}
                      onSelectSig={setSelectedSig}
                      onChangeSig={(s) => setSigs((all) => all.map((x) => x.id === s.id ? s : x))}
                      onRemoveSig={(id) => { setSigs((all) => all.filter((x) => x.id !== id)); setSelectedSig(null); }}
                      innerRef={(el) => (pageRefs.current[p.pageNum] = el)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating action for mobile */}
            {sigs.length > 0 && selectedSig && (
              <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-card shadow-2xl rounded-full px-4 py-2 border flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Signature selected</span>
                <Button size="sm" variant="destructive" onClick={() => { setSigs((s) => s.filter((x) => x.id !== selectedSig)); setSelectedSig(null); }}>
                  <Trash2 className="w-3 h-3 mr-1" />Remove
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
      {!fullscreen && !file && <Footer />}

      <SignatureModal open={sigModalOpen} onClose={() => setSigModalOpen(false)} onSave={onSignatureSave} />
    </div>
  );
}

function UploadPanel({ onFile, loading, onSendToOther }: { onFile: (f: File) => void; loading: boolean; onSendToOther: () => void }) {
  const [drag, setDrag] = useState(false);
  return (
    <div className="flex-1 container mx-auto px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <FileText className="w-3.5 h-3.5" /> Documents · Premium
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-3 tracking-tight">Work with any document</h1>
          <p className="text-muted-foreground text-base sm:text-lg">Open, view, sign, and download PDF, DOCX, XLSX, JPG or PNG.</p>
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          className={`block cursor-pointer rounded-3xl border-2 border-dashed transition-all p-8 sm:p-14 text-center bg-white dark:bg-card
            ${drag ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-primary/30 hover:border-primary'}`}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            {loading ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : <Upload className="w-8 h-8 text-primary" />}
          </div>
          <p className="font-semibold text-lg sm:text-xl">
            {loading ? 'Opening document...' : 'Drop file here or click to upload'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">PDF · DOCX · XLSX · JPG · PNG · Max 25 MB</p>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png,application/pdf,image/*"
            className="hidden"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          {[
            { icon: FileText, label: 'View' },
            { icon: PenLine, label: 'Sign' },
            { icon: Download, label: 'Download' },
            { icon: Send, label: 'Send to signer' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-card border rounded-2xl p-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="text-sm font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={onSendToOther} className="rounded-2xl h-11">
            <Send className="w-4 h-4 mr-2" /> Need someone else to sign? Use E-Sign requests
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThumbnailCanvas({ source }: { source: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const w = 112;
    const scale = w / source.width;
    c.width = w;
    c.height = source.height * scale;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, c.width, c.height);
  }, [source]);
  return <canvas ref={ref} className="w-full block bg-white" />;
}

function PageView({
  page, zoom, rotation, sigs, selectedSig, onSelectSig, onChangeSig, onRemoveSig, innerRef,
}: {
  page: RenderedPage;
  zoom: number;
  rotation: number;
  sigs: PlacedSig[];
  selectedSig: string | null;
  onSelectSig: (id: string) => void;
  onChangeSig: (s: PlacedSig) => void;
  onRemoveSig: (id: string) => void;
  innerRef: (el: HTMLDivElement | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dispScale, setDispScale] = useState(1);
  const baseW = Math.min(800, page.width) * zoom;

  useEffect(() => {
    const wrap = wrapRef.current!;
    wrap.querySelector('canvas.doc-canvas')?.remove();
    const clone = page.canvas.cloneNode(false) as HTMLCanvasElement;
    clone.width = page.canvas.width;
    clone.height = page.canvas.height;
    clone.getContext('2d')!.drawImage(page.canvas, 0, 0);
    clone.className = 'doc-canvas w-full h-auto block';
    wrap.prepend(clone);
    setDispScale(baseW / page.width);
  }, [page, baseW]);

  const rotated = rotation % 180 !== 0;

  return (
    <div
      ref={innerRef}
      data-page={page.pageNum}
      className="shadow-xl rounded-lg overflow-hidden bg-white transition-transform"
      style={{
        width: baseW,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center',
        marginBlock: rotated ? Math.abs(baseW - baseW * (page.height / page.width)) / 4 : 0,
      }}
    >
      <div ref={wrapRef} className="relative" onClick={(e) => e.stopPropagation()}>
        {sigs.map((s) => (
          <PlacedSignature
            key={s.id}
            sig={s}
            dispScale={dispScale}
            selected={selectedSig === s.id}
            onSelect={() => onSelectSig(s.id)}
            onChange={onChangeSig}
            onRemove={() => onRemoveSig(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
