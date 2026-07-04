import { Rnd } from 'react-rnd';
import { X, RotateCw } from 'lucide-react';
import { useState } from 'react';

export interface PlacedSig {
  id: string;
  pageNum: number;
  // in canvas-pixel space (natural)
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  dataUrl: string; // PNG data url
}

interface Props {
  sig: PlacedSig;
  dispScale: number; // display px per canvas px
  selected: boolean;
  onSelect: () => void;
  onChange: (s: PlacedSig) => void;
  onRemove: () => void;
}

export function PlacedSignature({ sig, dispScale, selected, onSelect, onChange, onRemove }: Props) {
  const [rotating, setRotating] = useState(false);

  const startRotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = (e.currentTarget as HTMLElement).closest('.rnd-wrap') as HTMLElement;
    if (!el) return;
    setRotating(true);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    const originRot = sig.rotation;
    const move = (ev: PointerEvent) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI);
      onChange({ ...sig, rotation: originRot + (a - startAngle) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setRotating(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <Rnd
      className="rnd-wrap"
      style={{ zIndex: selected ? 30 : 20 }}
      size={{ width: sig.w * dispScale, height: sig.h * dispScale }}
      position={{ x: sig.x * dispScale, y: sig.y * dispScale }}
      lockAspectRatio={sig.h / sig.w}
      bounds="parent"
      onDragStart={onSelect}
      onDragStop={(_, d) => onChange({ ...sig, x: d.x / dispScale, y: d.y / dispScale })}
      onResizeStop={(_, __, ref, ___, pos) =>
        onChange({
          ...sig,
          w: ref.offsetWidth / dispScale,
          h: ref.offsetHeight / dispScale,
          x: pos.x / dispScale,
          y: pos.y / dispScale,
        })
      }
      resizeHandleStyles={selected ? undefined : { bottomRight: { display: 'none' } }}
      enableResizing={selected ? { bottomRight: true, bottomLeft: true, topLeft: true, topRight: true } : false}
    >
      <div
        onPointerDown={onSelect}
        style={{ transform: `rotate(${sig.rotation}deg)`, transformOrigin: 'center' }}
        className={`w-full h-full relative ${selected ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-1 hover:ring-primary/50'} rounded-sm transition`}
      >
        <img src={sig.dataUrl} alt="signature" className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
        {selected && (
          <>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:scale-110 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              onPointerDown={startRotate}
              className="absolute left-1/2 -top-8 -translate-x-1/2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }}
            >
              <RotateCw className="w-4 h-4" />
            </div>
          </>
        )}
      </div>
    </Rnd>
  );
}
