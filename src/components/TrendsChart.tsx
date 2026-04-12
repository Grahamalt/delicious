"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DailyEntry {
  date: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  description: string;
}

interface Goals {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

type Range = "30d" | "90d" | "year" | "all";
type Metric = "calories" | "fat" | "carbs" | "protein";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rollingAvg(entries: DailyEntry[], metric: Metric, window: number): Array<{ date: string; value: number; avg: number | null }> {
  return entries.map((e, i) => {
    const startIdx = Math.max(0, i - window + 1);
    const slice = entries.slice(startIdx, i + 1);
    const sum = slice.reduce((s, x) => s + x[metric], 0);
    return {
      date: e.date,
      value: e[metric],
      avg: slice.length >= Math.min(window, 3) ? Math.round(sum / slice.length) : null,
    };
  });
}

export default function TrendsChart({ refreshKey }: { refreshKey?: number }) {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [range, setRange] = useState<Range>("30d");
  const [metric, setMetric] = useState<Metric>("calories");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let start: string;
    const end = todayISO();
    if (range === "30d") start = isoDaysAgo(30);
    else if (range === "90d") start = isoDaysAgo(90);
    else if (range === "year") start = isoDaysAgo(365);
    else start = "2000-01-01";

    const res = await fetch(`/api/daily?start=${start}&end=${end}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setGoals(data.goals);
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const chartData = useMemo(() => rollingAvg(entries, metric, 7), [entries, metric]);

  const overallAvg = useMemo(() => {
    if (entries.length === 0) return 0;
    return Math.round(entries.reduce((s, e) => s + e[metric], 0) / entries.length);
  }, [entries, metric]);

  if (loading || !goals) {
    return <div className="text-gray-500 text-center py-8">Loading trends...</div>;
  }

  const colors: Record<Metric, string> = {
    calories: "#3b82f6",
    fat: "#eab308",
    carbs: "#22c55e",
    protein: "#a855f7",
  };

  const goalDelta = overallAvg - goals[metric];
  const unit = metric === "calories" ? "" : "g";

  return (
    <div className="space-y-3">
      {/* Range tabs */}
      <div className="flex bg-gray-900 rounded-lg p-0.5">
        {(["30d", "90d", "year", "all"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 px-2 py-1 rounded-md text-xs transition-colors ${
              range === r ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {r === "30d" ? "30 days" : r === "90d" ? "90 days" : r === "year" ? "Year" : "All"}
          </button>
        ))}
      </div>

      {/* Metric tabs */}
      <div className="flex bg-gray-900 rounded-lg p-0.5">
        {(["calories", "fat", "carbs", "protein"] as Metric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`flex-1 px-2 py-1 rounded-md text-xs capitalize transition-colors ${
              metric === m ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="bg-gray-900 rounded-lg p-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-gray-500">Days logged</div>
          <div className="font-medium">{entries.length}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Avg</div>
          <div className="font-medium">{overallAvg}{unit}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">vs goal</div>
          <div className={`font-medium ${goalDelta > 0 ? "text-red-400" : "text-green-400"}`}>
            {goalDelta >= 0 ? "+" : ""}{goalDelta}{unit}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 rounded-lg p-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={10}
              tickFormatter={(d) => d.slice(5)}
              minTickGap={20}
            />
            <YAxis stroke="#6b7280" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              y={goals[metric]}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              label={{ value: "goal", fill: "#9ca3af", fontSize: 10, position: "right" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={colors[metric]}
              strokeWidth={1}
              dot={false}
              opacity={0.4}
              name="daily"
            />
            <Line
              type="monotone"
              dataKey="avg"
              stroke={colors[metric]}
              strokeWidth={2.5}
              dot={false}
              name="7-day avg"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
