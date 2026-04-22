'use client';

// ============================================================
// TrendCharts — Recomp trend charts powered by Recharts
// Charts: Weight | Waist | Shoulder | Waist:Weight Ratio | Shoulder:Waist Ratio
// ============================================================

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { TrendChartsProps, BodyScan } from '@/types/body-tracking';

// ── Data helpers ──────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function sortedScans(scans: BodyScan[]) {
  return [...scans].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Custom Tooltip ────────────────────────────────────────────
const CustomTooltip = ({
  active,
  payload,
  label,
  unit,
  decimals = 1,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  unit?: string;
  decimals?: number;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#1a1a1a] px-3 py-2 text-sm shadow-xl">
      <p className="mb-1 text-neutral-400">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-semibold">
          {typeof entry.value === 'number' ? entry.value.toFixed(decimals) : entry.value}
          {unit}
        </p>
      ))}
    </div>
  );
};

// ── Shared chart wrapper ──────────────────────────────────────
const ChartCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl bg-[#1a1a1a] p-4">
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ── Common chart style ────────────────────────────────────────
const axisStyle = { fontSize: 11, fill: '#6b7280' };
const gridStyle = { stroke: '#262626' };
const dotStyle = { fill: '#3b82f6', strokeWidth: 0, r: 3 };
const activeDotStyle = { fill: '#60a5fa', r: 5 };

// ── Weight Chart ──────────────────────────────────────────────
export function WeightChart({
  scans,
  targetWeightLbs,
}: {
  scans: BodyScan[];
  targetWeightLbs?: number;
}) {
  const data = sortedScans(scans)
    .filter((s) => s.weightLbs != null)
    .map((s) => ({
      date: formatDate(s.date),
      weight: +(s.weightLbs as number).toFixed(1),
    }));

  return (
    <ChartCard title="Weight" subtitle="lbs over time">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <Tooltip content={<CustomTooltip unit=" lbs" />} />
          {targetWeightLbs && (
            <ReferenceLine
              y={targetWeightLbs}
              stroke="#3b82f6"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{ value: 'Goal', fill: '#3b82f6', fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={dotStyle}
            activeDot={activeDotStyle}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Waist Chart ───────────────────────────────────────────────
export function WaistChart({
  scans,
  targetWaistCm,
}: {
  scans: BodyScan[];
  targetWaistCm?: number;
}) {
  const data = sortedScans(scans)
    .filter((s) => s.waistCm != null)
    .map((s) => ({
      date: formatDate(s.date),
      waist: +(s.waistCm as number).toFixed(1),
    }));

  return (
    <ChartCard title="Waist" subtitle="cm over time — lower is better">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip content={<CustomTooltip unit=" cm" />} />
          {targetWaistCm && (
            <ReferenceLine
              y={targetWaistCm}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{ value: 'Goal', fill: '#10b981', fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="waist"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ ...dotStyle, fill: '#10b981' }}
            activeDot={{ ...activeDotStyle, fill: '#34d399' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Shoulder Chart ────────────────────────────────────────────
export function ShoulderChart({
  scans,
  targetShoulderCm,
}: {
  scans: BodyScan[];
  targetShoulderCm?: number;
}) {
  const data = sortedScans(scans)
    .filter((s) => s.shoulderCm !== null && s.shoulderCm !== undefined)
    .map((s) => ({
      date: formatDate(s.date),
      shoulder: +(s.shoulderCm as number).toFixed(1),
    }));

  if (data.length === 0) {
    return (
      <ChartCard title="Shoulders" subtitle="cm over time — log shoulder measurement to see this chart">
        <div className="flex h-[180px] items-center justify-center text-xs text-neutral-600">
          No shoulder data yet — add shoulder measurement when logging scans.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Shoulders" subtitle="cm over time — higher is better">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip content={<CustomTooltip unit=" cm" />} />
          {targetShoulderCm && (
            <ReferenceLine
              y={targetShoulderCm}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{ value: 'Goal', fill: '#f59e0b', fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="shoulder"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ ...dotStyle, fill: '#f59e0b' }}
            activeDot={{ ...activeDotStyle, fill: '#fcd34d' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Shoulder-to-Waist Ratio Chart ─────────────────────────────
export function ShoulderToWaistChart({ scans }: { scans: BodyScan[] }) {
  const data = sortedScans(scans)
    .filter((s) => s.shoulderCm != null && s.waistCm != null && s.waistCm > 0)
    .map((s) => ({
      date: formatDate(s.date),
      // Higher = more pronounced V-taper
      ratio: +((s.shoulderCm as number) / (s.waistCm as number)).toFixed(3),
    }));

  if (data.length === 0) {
    return (
      <ChartCard
        title="Shoulder : Waist Ratio"
        subtitle="shoulder_cm ÷ waist_cm — higher = better V-taper"
      >
        <div className="flex h-[180px] items-center justify-center text-xs text-neutral-600">
          No shoulder data yet — add shoulder measurement when logging scans.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Shoulder : Waist Ratio"
      subtitle="shoulder_cm ÷ waist_cm — higher = stronger V-taper"
    >
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 0.01', 'dataMax + 0.01']}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-xl border border-neutral-800 bg-[#1a1a1a] px-3 py-2 text-sm shadow-xl">
                  <p className="mb-1 text-neutral-400">{label}</p>
                  <p className="font-semibold text-orange-400">
                    {Number(payload[0].value).toFixed(3)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {(payload[0].value as number) >= 1.4
                      ? '🔥 Strong V-taper'
                      : (payload[0].value as number) >= 1.3
                      ? '💪 Good taper'
                      : 'Keep building'}
                  </p>
                </div>
              );
            }}
          />
          {/* Reference line at 1.4 — strong V-taper threshold */}
          <ReferenceLine
            y={1.4}
            stroke="#f97316"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{ value: 'Goal', fill: '#f97316', fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="ratio"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ ...dotStyle, fill: '#f97316' }}
            activeDot={{ ...activeDotStyle, fill: '#fb923c' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Waist-to-Weight Ratio Chart ───────────────────────────────
export function RatioChart({ scans }: { scans: BodyScan[] }) {
  const data = sortedScans(scans)
    .filter((s) => s.waistCm != null && s.weightLbs != null && s.weightLbs > 0)
    .map((s) => ({
      date: formatDate(s.date),
      ratio: +((s.waistCm as number) / (s.weightLbs as number)).toFixed(4),
    }));

  return (
    <ChartCard
      title="Waist : Weight Ratio"
      subtitle="waist_cm ÷ weight_lbs — lower = fat loss signal"
    >
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 0.01', 'dataMax + 0.01']}
            tickFormatter={(v) => v.toFixed(3)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-xl border border-neutral-800 bg-[#1a1a1a] px-3 py-2 text-sm shadow-xl">
                  <p className="mb-1 text-neutral-400">{label}</p>
                  <p className="font-semibold text-purple-400">
                    {Number(payload[0].value).toFixed(4)}
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={0.55}
            stroke="#a855f7"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{ value: 'Target', fill: '#a855f7', fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="ratio"
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ ...dotStyle, fill: '#a855f7' }}
            activeDot={{ ...activeDotStyle, fill: '#c084fc' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Combined export (all charts) ──────────────────────────────
export default function TrendCharts({
  scans,
  targetWeightLbs,
  targetWaistCm,
  targetShoulderCm,
}: TrendChartsProps) {
  if (scans.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1a1a1a] p-8 text-center text-neutral-500 text-sm">
        No scans yet — log your first scan to see trends.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <WeightChart scans={scans} targetWeightLbs={targetWeightLbs} />
      <WaistChart scans={scans} targetWaistCm={targetWaistCm} />
      <ShoulderChart scans={scans} targetShoulderCm={targetShoulderCm} />
      <ShoulderToWaistChart scans={scans} />
      <RatioChart scans={scans} />
    </div>
  );
}
