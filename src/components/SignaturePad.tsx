import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RotateCcw, Check, PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SignaturePadProps {
  onSignatureChange?: (signatureDataUrl: string | null) => void;
}

export function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 140;
    const ctx = getContext();
    if (ctx) { ctx.strokeStyle = '#1a365d'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
  }, [getContext]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = getContext(); if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = getContext(); if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y); ctx.stroke(); setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas && hasSignature) onSignatureChange?.(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current; const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false); onSignatureChange?.(null);
  };

  return (
    <Card className="shadow-elevated border-0 overflow-hidden">
      <div className="navy-gradient px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-foreground">
            <div className="p-1.5 rounded-md bg-gold/20">
              <PenLine className="h-4 w-4 sm:h-5 sm:w-5 text-gold" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base">{t('signature.title')}</h3>
              <p className="text-xs text-primary-foreground/70 hidden sm:block">{t('signature.hint')}</p>
            </div>
          </div>
          {hasSignature && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Check className="h-3 w-3" />
                <span className="hidden sm:inline">{t('signature.added')}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={clearSignature} className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 h-8 px-2 sm:px-3">
                <RotateCcw className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline text-xs">{t('signature.clear')}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
      <CardContent className="p-0">
        <div className="relative bg-gradient-to-b from-gray-50 to-white">
          <div className="px-4 py-6 sm:px-8 sm:py-8">
            <div className="relative bg-white rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-gold/50 transition-colors">
              <canvas ref={canvasRef} className="w-full cursor-crosshair touch-none rounded-lg"
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
              <div className="absolute bottom-6 left-8 right-8 border-b-2 border-muted-foreground/30 pointer-events-none" />
              <div className="absolute bottom-2 left-8 text-[10px] text-muted-foreground/50 pointer-events-none">{t('signature.label')}</div>
              {!hasSignature && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <PenLine className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-muted-foreground/40 text-sm">{t('signature.draw')}</p>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 pb-4 sm:px-8 sm:pb-6">
            <p className="text-xs text-muted-foreground text-center bg-muted/50 rounded-md py-2 px-3">{t('signature.footer')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
