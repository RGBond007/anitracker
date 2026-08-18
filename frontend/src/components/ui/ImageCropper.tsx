import { useEffect, useRef, useState } from "react";

import { cx } from "../../lib/cx";

/** The square the server stores. Cropping here means it never has to guess. */
const OUTPUT = 512;
/** The viewport, in CSS pixels. Small enough to fit a phone beside its controls. */
const BOX = 240;
const MAX_ZOOM = 4;

/**
 * Pick the square of a picture that becomes a profile photo.
 *
 * Drag to move, the slider to zoom, and what is inside the circle is what gets
 * uploaded -- so a face off to one side of a wide photo does not end up cropped
 * out by a centre-crop on the server. Built on pointer events rather than mouse
 * ones, so dragging works the same under a finger.
 *
 * The server crops and re-encodes regardless. This is about giving the person
 * uploading the choice, not about trusting the result.
 */
export function ImageCropper({
  file,
  onCancel,
  onCropped,
  busy = false,
  labels,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
  busy?: boolean;
  labels: { zoom: string; cancel: string; save: string; hint: string; failed: string };
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [broken, setBroken] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => setBroken(true);
    img.src = url;
    // The bitmap is decoded by then; keeping the URL alive would leak it.
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (broken) return <p className="text-sm text-stamp-text">{labels.failed}</p>;
  if (!image) return <div className="h-[240px] animate-pulse rounded-control bg-surface" />;

  // At zoom 1 the shorter side exactly fills the box, which is `object-fit: cover`.
  const base = BOX / Math.min(image.naturalWidth, image.naturalHeight);
  const scale = base * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;

  /** Never let the crop square run off the edge of the picture. */
  const clamp = (next: { x: number; y: number }) => {
    const maxX = Math.max(0, (width - BOX) / 2);
    const maxY = Math.max(0, (height - BOX) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  const nudge = (dx: number, dy: number) =>
    setOffset((current) => clamp({ x: current.x + dx, y: current.y + dy }));

  const crop = () => {
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const context = canvas.getContext("2d");
    if (!context) return;

    // The box, expressed in the source image's own pixels.
    const side = BOX / scale;
    const sx = image.naturalWidth / 2 - offset.x / scale - side / 2;
    const sy = image.naturalHeight / 2 - offset.y / scale - side / 2;
    context.drawImage(image, sx, sy, side, side, 0, 0, OUTPUT, OUTPUT);

    canvas.toBlob(
      (blob) => blob && onCropped(blob),
      // WebP everywhere it exists; a browser without it silently produces PNG,
      // which the server accepts just the same.
      "image/webp",
      0.92,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div
          role="application"
          aria-label={labels.hint}
          tabIndex={0}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            nudge(e.clientX - drag.current.x, e.clientY - drag.current.y);
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          // Arrow keys do the same job for anyone not using a pointer.
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 5;
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [step, 0],
              ArrowRight: [-step, 0],
              ArrowUp: [0, step],
              ArrowDown: [0, -step],
            };
            const move = moves[e.key];
            if (!move) return;
            e.preventDefault();
            nudge(move[0], move[1]);
          }}
          className={cx(
            "relative touch-none overflow-hidden rounded-full border border-line bg-surface",
            "cursor-grab active:cursor-grabbing",
          )}
          style={{ width: BOX, height: BOX }}
        >
          <img
            src={image.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width,
              height,
              left: BOX / 2 - width / 2 + offset.x,
              top: BOX / 2 - height / 2 + offset.y,
            }}
          />
        </div>
      </div>

      <p className="text-center text-[12px] text-text-faint">{labels.hint}</p>

      <label className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">
          {labels.zoom}
        </span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => {
            setZoom(Number(e.target.value));
            // Re-clamp: zooming out can leave the old offset outside the picture.
            setOffset((current) => clamp(current));
          }}
          className="h-1 flex-1 accent-stamp"
          aria-label={labels.zoom}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-control px-3 py-2 text-sm text-text-dim transition-colors hover:text-text"
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          onClick={crop}
          disabled={busy}
          className={cx(
            "rounded-control bg-stamp px-[18px] py-2.5 text-sm font-semibold text-ink-950",
            "transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {labels.save}
        </button>
      </div>
    </div>
  );
}
