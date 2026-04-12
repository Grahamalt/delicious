"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildWeek(entries: DailyEntry[], start: string, end: string) {
  const map = new Map(entries.map((e) => [e.date, e]));
  const days: Array<{
    date: string;
    label: string;
    calories: number;
    fat: number;
    carbs: number;
    protein: number;
    description: string;
  }> = [];
  const cur = new Date(start + "T12:00:00");
  const last = new Date(end + "T12:00:00");
  while (cur <= last) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    const e = map.get(iso);
    days.push({
      date: iso,
      label: DAY_NAMES[cur.getDay()],
      calories: e?.calories || 0,
      fat: e?.fat || 0,
      carbs: e?.carbs || 0,
      protein: e?.protein || 0,
      description: e?.description || "",
    });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function WeekChart({ refreshKey }: { refreshKey?: number }) {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<"calories" | "fat" | "carbs" | "protein">("calories");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/daily");
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setGoals(data.goals);
      setStart(data.start);
      setEnd(data.end);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading || !goals) {
    return <div className="text-gray-500 text-center py-8">Loading...</div>;
  }

  const days = buildWeek(entries, start, end);
  const loggedDays = days.filter((d) => d.calories > 0);
  const avg = {
    calories: loggedDays.length
      ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length)
      : 0,
    fat: loggedDays.length
      ? Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedDays.length)
      : 0,
    carbs: loggedDays.length
      ? Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length)
      : 0,
    protein: loggedDays.length
      ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length)
      : 0,
  };

  const colors: Record<typeof metric, string> = {
    calories: "#3b82f6",
    fat: "#eab308",
    carbs: "#22c55e",
    protein: "#a855f7",
  };

  return (
    <div className="space-y-3">
      {/* Metric tabs */}
      <div className="flex bg-gray-900 rounded-lg p-0.5">
        {(["calories", "fat", "carbs", "protein"] as const).map((m) => (
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

      {/* Average vs goal */}
      <div className="bg-gray-900 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-xs text-gray-500">Avg this week</div>
          <div className="font-medium">{avg[metric]}{metric === "calories" ? "" : "g"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Goal</div>
          <div className="font-medium">{goals[metric]}{metric === "calories" ? "" : "g"}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 rounded-lg p-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
              cursor={{ fill: "#1f2937" }}
            />
            <ReferenceLine
              y={goals[metric]}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              label={{ value: "goal", fill: "#9ca3af", fontSize: 10, position: "right" }}
            />
            <Bar dataKey={metric} fill={colors[metric]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Day list */}
      <div className="space-y-1">
        {days.map((d) => (
          <div key={d.date} className="bg-gray-900 rounded-lg p-2 flex justify-between items-center text-xs">
            <div className="flex-1 min-w-0">
              <div className="text-gray-400">{d.label}</div>
              <div className="text-gray-500 truncate">{d.description || "—"}</div>
            </div>
            <div className="text-gray-400 whitespace-nowrap ml-2">
              {d.calories} / {d.fat}f / {d.carbs}c / {d.protein}p
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
