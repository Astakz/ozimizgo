import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eraser, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange?: (signatureDataUrl: string | null) => void;
}

export function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return ctx;
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 120;

    const ctx = getContext();
    if (ctx) {
      ctx.strokeStyle = '#1a365d';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
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
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = getContext();
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = getContext();
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas && hasSignature) {
        onSignatureChange?.(canvas.toDataURL('image/png'));
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange?.(null);
  };

  return (
    <Card className="shadow-sm border-2 border-dashed border-muted-foreground/30">
      <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm sm:text-base">
          <span className="flex items-center gap-2 text-muted-foreground">
            <PenTool className="h-4 w-4 shrink-0" />
            <span className="text-xs sm:text-sm">Поставьте подпись в поле ниже</span>
          </span>
          {hasSignature && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSignature}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto"
            >
              <Eraser className="h-4 w-4 mr-1" />
              Очистить
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
        <div className="relative w-full">
          <div className="absolute bottom-4 left-0 right-0 border-b border-muted-foreground/50 pointer-events-none" />
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair touch-none bg-background rounded"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasSignature && (
            <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50 text-xs sm:text-sm pointer-events-none whitespace-nowrap">
              Подпись: _________________________
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Если допустили ошибку, можно стереть и поставить заново
        </p>
      </CardContent>
    </Card>
  );
}
