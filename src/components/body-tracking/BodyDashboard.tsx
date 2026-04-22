'use client';

// ============================================================
// BodyDashboard — Main dashboard view
// Top stats | Photo comparison | Trend charts | History grid
// ============================================================

import { useState, useMemo } from 'react';
import type { BodyScan, PhotoAngle } from '@/types/body-tracking';
import { PHOTO_ANGLE_LABELS } from '@/types/body-tracking';
import TrendCharts from './TrendCharts';
import ScanHistoryGrid from './ScanHistoryGrid';

// ── Helpers ───────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function delta(current: number, previous: number, decimals = 1) {
  const diff = +(current - previous).toFixed(decimals);
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff}`;
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({
  label,
  value,
  unit,
  change,
  changePositive,
}: {
  label: string;
  value: string;
  unit: string;
  change?: string;
  changePositive?: boolean; // true = green, false = red, undefined = neutral
}) {
  const changeColor =
    changePositive === undefined
      ? 'text-neutral-500'
      : changePositive
      ? 'text-green-400'
      : 'text-red-400';

  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[#1a1a1a] p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-sm text-neutral-500">{unit}</span>
      </div>
      {change !== undefined && (
        <span className={`text-xs font-medium ${changeColor}`}>{change} from last</span>
      )}
    </div>
  );
}

// ── Photo Comparison Panel ────────────────────────────────────
function PhotoComparison({ scans }: { scans: BodyScan[] }) {
  const sorted = [...scans].sort((a, b) => a.date.localeCompare(b.date));
  const [leftDate, setLeftDate] = useState(sorted[0]?.date ?? '');
  const [rightDate, setRightDate] = useState(sorted[sorted.length - 1]?.date ?? '');
  const [angle, setAngle] = useState<PhotoAngle>('front');

  const leftScan = scans.find((s) => s.date === leftDate);
  const rightScan = scans.find((s) => s.date === rightDate);

  const photoKey: Record<PhotoAngle, keyof BodyScan> = {
    front: 'photoFrontUrl',
    side_left: 'photoSideLeftUrl',
    side_right: 'photoSideRightUrl',
    back: 'photoBackUrl',
  };

  if (scans.length < 2) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#1a1a1a] p-4">
      <h3 className="text-sm font-semibold text-white">Photo Comparison</h3>

      {/* Angle tabs */}
      <div className="flex gap-1 rounded-xl bg-neutral-900 p-1">
        {(Object.keys(PHOTO_ANGLE_LABELS) as PhotoAngle[]).map((a) => (
          <button
            key={a}
            onClick={() => setAngle(a)}
            className={[
              'flex-1 rounded-lg py-1.5 text-xs font-medium transition-all',
              angle === a ? 'bg-blue-600 text-white' : 'text-neutral-400',
            ].join(' ')}
          >
            {PHOTO_ANGLE_LABELS[a].split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Date pickers + photos */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { date: leftDate, setDate: setLeftDate, scan: leftScan, label: 'Before' },
          { date: rightDate, setDate: setRightDate, scan: rightScan, label: 'After' },
        ].map(({ date, setDate, scan, label }) => (
          <div key={label} className="flex flex-col gap-2">
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-white focus:outline-none"
            >
              {sorted.map((s) => (
                <option key={s.date} value={s.date}>
                  {formatDate(s.date)}
                </option>
              ))}
            </select>

            {/* Photo */}
            <div className="aspect-[3/5] overflow-hidden rounded-xl bg-neutral-900">
              {scan && (scan[photoKey[angle]] as string | null) ? (
                <img
                  src={scan[photoKey[angle]] as string}
                  alt={`${label} — ${PHOTO_ANGLE_LABELS[angle]}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                  <span className="text-2xl opacity-30">📷</span>
                  <span className="text-xs text-neutral-600">No photo</span>
                </div>
              )}
            </div>

            {/* Label */}
            <div className="text-center">
              <p className="text-xs text-neutral-500">{label}</p>
              {scan && (
                <p className="text-xs font-semibold text-white">
                  {scan.weightLbs != null ? `${scan.weightLbs} lbs` : '—'}
                  {scan.waistCm != null ? ` · ${scan.waistCm} cm` : ''}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
interface BodyDashboardProps {
  /** Pass real scans from API; falls back to MOCK_SCANS if empty */
  scans?: BodyScan[];
  /** Target weight for chart reference line */
  targetWeightLbs?: number;
  /** Target waist in cm for chart reference line */
  targetWaistCm?: number;
  /** Target shoulder in cm for chart reference line */
  targetShoulderCm?: number;
}

export default function BodyDashboard({
  scans: scansProp,
  targetWeightLbs,
  targetWaistCm,
  targetShoulderCm,
}: BodyDashboardProps) {
  const scans = scansProp ?? [];

  const sorted = useMemo(
    () => [...scans].sort((a, b) => b.date.localeCompare(a.date)),
    [scans],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1a1a1a] p-8 text-center">
        <p className="text-sm text-neutral-400">No scans yet.</p>
        <p className="mt-1 text-xs text-neutral-600">
          Switch to the Log Scan tab to record your first entry.
        </p>
      </div>
    );
  }

  const latest = sorted[0];
  const previous = sorted[1];

  // Deltas (only when both current and previous have the value)
  const weightDelta =
    previous && latest.weightLbs != null && previous.weightLbs != null
      ? delta(latest.weightLbs, previous.weightLbs)
      : undefined;
  const waistDelta =
    previous && latest.waistCm != null && previous.waistCm != null
      ? delta(latest.waistCm, previous.waistCm, 1)
      : undefined;
  const shoulderDelta =
    previous && latest.shoulderCm != null && previous.shoulderCm != null
      ? delta(latest.shoulderCm, previous.shoulderCm, 1)
      : undefined;
  const swRatioDelta =
    previous &&
    latest.shoulderCm != null && latest.waistCm != null &&
    previous.shoulderCm != null && previous.waistCm != null
      ? delta(
          latest.shoulderCm / latest.waistCm,
          previous.shoulderCm / previous.waistCm,
          3,
        )
      : undefined;
  const wwRatioDelta =
    previous &&
    latest.waistCm != null && latest.weightLbs != null &&
    previous.waistCm != null && previous.weightLbs != null
      ? delta(
          latest.waistCm / latest.weightLbs,
          previous.waistCm / previous.weightLbs,
          4,
        )
      : undefined;

  // Color semantics: waist/ratio lower is better, shoulder/sw-ratio higher is better
  const waistChangeGood = waistDelta ? parseFloat(waistDelta) < 0 : undefined;
  const shoulderChangeGood = shoulderDelta ? parseFloat(shoulderDelta) > 0 : undefined;
  const swRatioChangeGood = swRatioDelta ? parseFloat(swRatioDelta) > 0 : undefined;
  const wwRatioChangeGood = wwRatioDelta ? parseFloat(wwRatioDelta) < 0 : undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* Stats row — top 3 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Weight"
          value={latest.weightLbs != null ? latest.weightLbs.toFixed(1) : '—'}
          unit={latest.weightLbs != null ? 'lbs' : ''}
          change={weightDelta}
          changePositive={weightDelta ? parseFloat(weightDelta) < 0 : undefined}
        />
        <StatCard
          label="Waist"
          value={latest.waistCm != null ? latest.waistCm.toFixed(1) : '—'}
          unit={latest.waistCm != null ? 'cm' : ''}
          change={waistDelta}
          changePositive={waistChangeGood}
        />
        <StatCard
          label="Shoulders"
          value={latest.shoulderCm != null ? latest.shoulderCm.toFixed(1) : '—'}
          unit={latest.shoulderCm != null ? 'cm' : ''}
          change={shoulderDelta}
          changePositive={shoulderChangeGood}
        />
      </div>

      {/* Stats row — ratios */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Shoulder : Waist"
          value={
            latest.shoulderCm != null && latest.waistCm != null
              ? (latest.shoulderCm / latest.waistCm).toFixed(2)
              : '—'
          }
          unit=""
          change={swRatioDelta}
          changePositive={swRatioChangeGood}
        />
        <StatCard
          label="Waist : Weight"
          value={
            latest.waistCm != null && latest.weightLbs != null
              ? (latest.waistCm / latest.weightLbs).toFixed(3)
              : '—'
          }
          unit=""
          change={wwRatioDelta}
          changePositive={wwRatioChangeGood}
        />
      </div>

      {/* Photo comparison */}
      <PhotoComparison scans={scans} />

      {/* Trend charts */}
      <TrendCharts
        scans={scans}
        targetWeightLbs={targetWeightLbs}
        targetWaistCm={targetWaistCm}
        targetShoulderCm={targetShoulderCm}
      />

      {/* Scan history grid */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Scan History</h3>
        <ScanHistoryGrid scans={scans} />
      </div>
    </div>
  );
}
