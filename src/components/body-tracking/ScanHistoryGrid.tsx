'use client';

// ============================================================
// ScanHistoryGrid — Grid of scan cards sorted by date
// Each card: date, weight, waist, front photo thumbnail
// Tap to expand full scan detail
// ============================================================

import { useState } from 'react';
import type { BodyScan, ScanHistoryGridProps, PhotoAngle } from '@/types/body-tracking';
import { PHOTO_ANGLE_LABELS } from '@/types/body-tracking';

// ── Format helpers ────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Detail Modal ──────────────────────────────────────────────
function ScanDetailModal({
  scan,
  onClose,
}: {
  scan: BodyScan;
  onClose: () => void;
}) {
  const [activeAngle, setActiveAngle] = useState<PhotoAngle>('front');

  const photoMap: Record<PhotoAngle, string | null> = {
    front: scan.photoFrontUrl,
    side_left: scan.photoSideLeftUrl,
    side_right: scan.photoSideRightUrl,
    back: scan.photoBackUrl,
  };

  const availableAngles = (Object.keys(photoMap) as PhotoAngle[]).filter(
    (a) => !!photoMap[a],
  );

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      {/* Modal sheet */}
      <div
        className="w-full max-w-md rounded-t-3xl bg-[#1a1a1a] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-neutral-700" />
        </div>

        <div className="flex flex-col gap-5 p-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">{formatDate(scan.date)}</h3>
            <button
              onClick={onClose}
              className="rounded-full bg-neutral-800 p-2 text-neutral-400 hover:text-white"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Weight', value: scan.weightLbs != null ? `${scan.weightLbs} lbs` : '—' },
              { label: 'Waist', value: scan.waistCm != null ? `${scan.waistCm} cm` : '—' },
              ...(scan.shoulderCm != null && scan.waistCm != null
                ? [
                    { label: 'Shoulders', value: `${scan.shoulderCm} cm` },
                    {
                      label: 'Shoulder:Waist',
                      value: (scan.shoulderCm / scan.waistCm).toFixed(2),
                    },
                  ]
                : scan.waistCm != null && scan.weightLbs != null
                ? [{ label: 'W/W Ratio', value: (scan.waistCm / scan.weightLbs).toFixed(4) }]
                : []),
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-col items-center rounded-xl bg-neutral-900 py-3 px-2"
              >
                <span className="text-xs text-neutral-500">{label}</span>
                <span className="mt-0.5 text-sm font-bold text-white">{value}</span>
              </div>
            ))}
          </div>

          {/* Photo viewer */}
          {availableAngles.length > 0 && (
            <div className="flex flex-col gap-3">
              {/* Large photo */}
              <div className="relative aspect-[3/5] w-full overflow-hidden rounded-2xl bg-neutral-900">
                <img
                  src={photoMap[activeAngle] ?? ''}
                  alt={PHOTO_ANGLE_LABELS[activeAngle]}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
                  {PHOTO_ANGLE_LABELS[activeAngle]}
                </div>
              </div>

              {/* Angle selector */}
              <div className="flex gap-2">
                {availableAngles.map((angle) => (
                  <button
                    key={angle}
                    onClick={() => setActiveAngle(angle)}
                    className={[
                      'flex-1 overflow-hidden rounded-xl aspect-square border transition-all',
                      activeAngle === angle
                        ? 'border-blue-500'
                        : 'border-neutral-800',
                    ].join(' ')}
                  >
                    <img
                      src={photoMap[angle] ?? ''}
                      alt={PHOTO_ANGLE_LABELS[angle]}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {scan.notes && (
            <div className="rounded-xl bg-neutral-900 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Notes</p>
              <p className="text-sm text-neutral-200">{scan.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Scan Card ─────────────────────────────────────────────────
function ScanCard({
  scan,
  onClick,
}: {
  scan: BodyScan;
  onClick: () => void;
}) {
  const hasFrontPhoto = !!scan.photoFrontUrl;

  return (
    <button
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-[#1a1a1a] text-left transition-all active:scale-[0.97] hover:border-neutral-700"
    >
      {/* Photo thumbnail */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-900">
        {hasFrontPhoto ? (
          <img
            src={scan.photoFrontUrl!}
            alt={`Front — ${scan.date}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-neutral-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="flex flex-col gap-0.5 p-3">
        <p className="text-xs text-neutral-400">{formatDate(scan.date)}</p>
        <p className="text-sm font-bold text-white">
          {scan.weightLbs != null ? `${scan.weightLbs} lbs` : '—'}
        </p>
        {scan.waistCm != null && (
          <p className="text-xs text-neutral-500">{scan.waistCm} cm waist</p>
        )}
        {scan.shoulderCm != null && scan.waistCm != null && (
          <p className="text-xs text-amber-500/80">
            {(scan.shoulderCm / scan.waistCm).toFixed(2)} S:W
          </p>
        )}
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function ScanHistoryGrid({
  scans,
  onScanClick,
}: ScanHistoryGridProps) {
  const [selectedScan, setSelectedScan] = useState<BodyScan | null>(null);

  // Sort newest first
  const sorted = [...scans].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1a1a1a] p-8 text-center">
        <p className="text-neutral-500 text-sm">No scans yet</p>
        <p className="text-neutral-600 text-xs mt-1">Log your first body scan above</p>
      </div>
    );
  }

  const handleClick = (scan: BodyScan) => {
    setSelectedScan(scan);
    onScanClick?.(scan);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sorted.map((scan) => (
          <ScanCard key={scan.id} scan={scan} onClick={() => handleClick(scan)} />
        ))}
      </div>

      {selectedScan && (
        <ScanDetailModal
          scan={selectedScan}
          onClose={() => setSelectedScan(null)}
        />
      )}
    </>
  );
}
