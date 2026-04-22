'use client';

// ============================================================
// BodyScanCapture — Mobile-first camera capture component
// Guides the user through 4 body angles with silhouette overlays
// ============================================================

import { useState, useRef, useCallback } from 'react';
import type { BodyScanCaptureProps, PhotoAngle } from '@/types/body-tracking';
import { PHOTO_ANGLE_LABELS } from '@/types/body-tracking';

// ── Angle order ───────────────────────────────────────────────
const ANGLES: PhotoAngle[] = ['front', 'side_left', 'side_right', 'back'];

// ── SVG Silhouette Overlays ───────────────────────────────────
// Simple SVG silhouettes — swap with higher-fidelity assets if desired
const Silhouette = ({ angle }: { angle: PhotoAngle }) => {
  const isProfile = angle === 'side_left' || angle === 'side_right';
  const isBack = angle === 'back';
  const flip = angle === 'side_right' ? 'scale(-1,1) translate(-100,0)' : '';

  return (
    <svg
      viewBox="0 0 100 200"
      className="h-full w-auto opacity-20"
      aria-hidden="true"
    >
      {isProfile ? (
        // Side silhouette (very simplified)
        <g transform={flip}>
          {/* head */}
          <ellipse cx="55" cy="22" rx="12" ry="14" fill="white" />
          {/* neck */}
          <rect x="51" y="34" width="8" height="8" fill="white" />
          {/* torso */}
          <path d="M42 42 Q30 80 34 110 L66 110 Q70 80 58 42Z" fill="white" />
          {/* left arm */}
          <path d="M42 44 Q28 70 30 100 L36 100 Q36 72 48 46Z" fill="white" />
          {/* legs */}
          <path d="M34 110 Q30 150 32 190 L44 190 Q44 150 50 110Z" fill="white" />
          <path d="M66 110 Q68 150 68 190 L56 190 Q54 150 50 110Z" fill="white" />
        </g>
      ) : (
        // Front / back silhouette (same shape, label differentiates)
        <>
          {/* head */}
          <ellipse cx="50" cy="22" rx="14" ry="16" fill="white" />
          {/* neck */}
          <rect x="44" y="36" width="12" height="8" fill="white" />
          {/* torso */}
          <path d="M28 44 Q22 80 26 112 L74 112 Q78 80 72 44Z" fill="white" />
          {/* left arm */}
          <path d="M28 46 Q14 72 16 106 L24 106 Q24 74 36 48Z" fill="white" />
          {/* right arm */}
          <path d="M72 46 Q86 72 84 106 L76 106 Q76 74 64 48Z" fill="white" />
          {/* left leg */}
          <path d="M26 112 Q22 152 24 192 L40 192 Q40 152 50 112Z" fill="white" />
          {/* right leg */}
          <path d="M74 112 Q78 152 76 192 L60 192 Q60 152 50 112Z" fill="white" />
          {/* back cross-hatch hint */}
          {isBack && (
            <line x1="50" y1="44" x2="50" y2="112" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          )}
        </>
      )}
    </svg>
  );
};

// ── Progress dots ─────────────────────────────────────────────
const ProgressDots = ({
  current,
  captured,
}: {
  current: number;
  captured: Set<PhotoAngle>;
}) => (
  <div className="flex items-center justify-center gap-3">
    {ANGLES.map((angle, i) => {
      const done = captured.has(angle);
      const active = i === current;
      return (
        <div
          key={angle}
          className={[
            'flex flex-col items-center gap-1',
          ].join(' ')}
        >
          <div
            className={[
              'h-3 w-3 rounded-full transition-all duration-200',
              done
                ? 'bg-blue-500 scale-110'
                : active
                ? 'bg-blue-400 ring-2 ring-blue-400 ring-offset-2 ring-offset-black'
                : 'bg-neutral-700',
            ].join(' ')}
          />
          <span className="text-[10px] text-neutral-500">
            {PHOTO_ANGLE_LABELS[angle].split(' ')[0]}
          </span>
        </div>
      );
    })}
  </div>
);

// ── Main Component ────────────────────────────────────────────
export default function BodyScanCapture({
  onPhotosChange,
  existingPhotos = {},
}: BodyScanCaptureProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captured, setCaptured] = useState<Partial<Record<PhotoAngle, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<PhotoAngle, string>>>(
    // Pre-populate previews from existing URLs (edit flow)
    Object.fromEntries(
      Object.entries(existingPhotos).map(([k, v]) => [k, v ?? '']),
    ) as Partial<Record<PhotoAngle, string>>,
  );

  const capturedAngles = new Set(Object.keys(captured) as PhotoAngle[]);
  const currentAngle = ANGLES[currentIndex];

  // Hidden file inputs — one per angle
  const inputRefs = useRef<Partial<Record<PhotoAngle, HTMLInputElement | null>>>({});

  const handleFileChange = useCallback(
    (angle: PhotoAngle) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Generate preview URL
      const url = URL.createObjectURL(file);

      setCaptured((prev) => {
        const next = { ...prev, [angle]: file };
        onPhotosChange(next);
        return next;
      });
      setPreviews((prev) => ({ ...prev, [angle]: url }));

      // Auto-advance to next uncaptured angle
      const nextIndex = ANGLES.findIndex(
        (a, i) => i > currentIndex && !captured[a],
      );
      if (nextIndex !== -1) {
        setCurrentIndex(nextIndex);
      }
    },
    [currentIndex, captured, onPhotosChange],
  );

  const triggerCapture = (angle: PhotoAngle) => {
    inputRefs.current[angle]?.click();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Progress */}
      <ProgressDots current={currentIndex} captured={capturedAngles} />

      {/* Current angle capture area */}
      <div
        className="relative mx-auto flex aspect-[3/5] w-full max-w-xs cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-neutral-700 bg-neutral-900"
        onClick={() => triggerCapture(currentAngle)}
        role="button"
        aria-label={`Capture ${PHOTO_ANGLE_LABELS[currentAngle]} photo`}
      >
        {/* Preview image if captured */}
        {previews[currentAngle] ? (
          <img
            src={previews[currentAngle]}
            alt={`${PHOTO_ANGLE_LABELS[currentAngle]} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            {/* Silhouette guide */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Silhouette angle={currentAngle} />
            </div>
            {/* Camera icon */}
            <div className="relative z-10 flex flex-col items-center gap-2 text-neutral-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                />
              </svg>
              <span className="text-sm font-medium">
                Tap to capture
              </span>
              <span className="text-xs text-neutral-500">
                {PHOTO_ANGLE_LABELS[currentAngle]}
              </span>
            </div>
          </>
        )}

        {/* Re-take badge on captured */}
        {previews[currentAngle] && (
          <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
            Tap to re-take
          </div>
        )}

        {/* Angle label top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <p className="text-center text-sm font-semibold text-white">
            {PHOTO_ANGLE_LABELS[currentAngle]}
          </p>
        </div>
      </div>

      {/* Hidden file inputs */}
      {ANGLES.map((angle) => (
        <input
          key={angle}
          ref={(el) => { inputRefs.current[angle] = el; }}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange(angle)}
          aria-label={`Upload ${PHOTO_ANGLE_LABELS[angle]} photo`}
        />
      ))}

      {/* Angle selector thumbnails */}
      <div className="grid grid-cols-4 gap-2">
        {ANGLES.map((angle, i) => (
          <button
            key={angle}
            type="button"
            onClick={() => {
              setCurrentIndex(i);
              // Small delay to let re-render settle before clicking
              setTimeout(() => triggerCapture(angle), 100);
            }}
            className={[
              'relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border transition-all duration-150',
              i === currentIndex
                ? 'border-blue-500 ring-1 ring-blue-500'
                : 'border-neutral-800',
              'bg-neutral-900',
            ].join(' ')}
          >
            {previews[angle] ? (
              <>
                <img
                  src={previews[angle]}
                  alt={PHOTO_ANGLE_LABELS[angle]}
                  className="h-full w-full object-cover"
                />
                {/* Check mark overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="text-lg">✓</span>
                </div>
              </>
            ) : (
              <span className="text-[10px] text-neutral-500 text-center px-1">
                {PHOTO_ANGLE_LABELS[angle]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Skip / all done note */}
      <p className="text-center text-xs text-neutral-600">
        Photos are optional — skip any angle and log measurements only
      </p>
    </div>
  );
}
