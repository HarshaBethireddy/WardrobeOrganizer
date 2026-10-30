import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui';
import { canvasToBlob, cropImage, decodeImage } from '@/lib/image';

export function CropSheet({ open, src, photo, onClose, onDone }: { open: boolean; src?: string; photo?: Blob; onClose: () => void; onDone: (b: Blob) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    if (!photo || !area) return;
    setBusy(true);
    try {
      const bmp = await decodeImage(photo);
      const c = cropImage(bmp, area, rotation);
      onDone(await canvasToBlob(c, 'image/webp', 0.9));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Crop and rotate" full
      footer={<div className="flex gap-2"><Button className="flex-1" onClick={onClose}>Cancel</Button><Button variant="primary" className="flex-1" disabled={!area || busy} onClick={apply}>Use crop</Button></div>}>
      <div className="relative h-[55dvh] overflow-hidden rounded-3xl bg-surface-2">
        {src && <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={4 / 5} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(_, px) => setArea(px)} />}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <label className="flex-1 text-sm text-muted">
          Zoom
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-2 w-full accent-white" />
        </label>
        <Button icon={<RotateCw size={18} />} onClick={() => setRotation((r) => (r + 90) % 360)}>Rotate</Button>
      </div>
    </Sheet>
  );
}
