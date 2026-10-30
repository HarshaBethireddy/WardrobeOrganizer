import { Camera, ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui';

/** "Take photo" (camera) and "Choose photos" (gallery, several at once). */
export function PhotoPickers({ onFiles, compact }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const take = (list: FileList | null) => { const files = [...(list ?? [])].filter((f) => f.type.startsWith('image/') || f.type === ''); if (files.length) onFiles(files); };
  return (
    <div className={compact ? 'flex gap-2' : 'grid gap-2'}>
      <Button variant="primary" size={compact ? 'md' : 'lg'} className="flex-1" icon={<Camera size={20} />} onClick={() => cam.current?.click()}>Take photo</Button>
      <Button size={compact ? 'md' : 'lg'} className="flex-1" icon={<ImagePlus size={20} />} onClick={() => gal.current?.click()}>Choose photos</Button>
      <input ref={cam} data-testid="camera-input" type="file" accept="image/*" capture="environment" hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      <input ref={gal} data-testid="gallery-input" type="file" accept="image/*" multiple hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
