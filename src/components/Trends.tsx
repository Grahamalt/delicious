"use client";

import { useState, useEffect } from "react";

interface WeekSummary {
  weekStart: string;
  averages: { calories: number; fat: number; carbs: number; protein: number };
  daysLogged: number;
}

interface TrendsData {
  weeks: WeekSummary[];
  goals: { calories: number; fat: number; carbs: number; protein: number };
}

function DotIndicator({ value, goal, type }: { value: number; goal: number; type: "under" | "over" }) {
  const ratio = value / goal;
  let color: string;

  if (type === "under") {
    // For cals/fat/carbs: green when at or under goal, yellow when slightly over, red when way over
    if (ratio <= 1.0) color = "bg-green-400";
    else if (ratio <= 1.1) color = "bg-yellow-400";
    else color = "bg-red-400";
  } else {
    // For protein: green when at or over goal, yellow when close, red when way under
    if (ratio >= 1.0) color = "bg-green-400";
    else if (ratio >= 0.9) color = "bg-yellow-400";
    else color = "bg-red-400";
  }

  return <div className={`w-2.5 h-2.5 rounded-full ${color}`} />;
}

function formatWeekLabel(weekStart: string): string {
  const parts = weekStart.split(" ");
  return `${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)} ${parts[1]}`;
}

export default function Trends() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Loading trends...</div>;
  }

  if (!data || data.weeks.length === 0) {
    return <div className="text-gray-500 text-center py-8">No weekly data yet</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Weekly averages for {new Date().getFullYear()}. Dots show performance vs goals.
      </p>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" /> On target
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Close
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" /> Off
        </div>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_60px_60px_60px_60px_30px] gap-1 text-xs text-gray-500 px-3">
        <div>Week</div>
        <div className="text-right">Cal</div>
        <div className="text-right">Fat</div>
        <div className="text-right">Carb</div>
        <div className="text-right">Prot</div>
        <div />
      </div>

      {/* Weeks */}
      <div className="space-y-1">
        {data.weeks.map((week) => (
          <div
            key={week.weekStart}
            className="grid grid-cols-[1fr_60px_60px_60px_60px_30px] gap-1 items-center bg-gray-900 rounded-lg px-3 py-2"
          >
            <div className="text-sm text-gray-300">
              {formatWeekLabel(week.weekStart)}
              <span className="text-xs text-gray-600 ml-1">{week.daysLogged}d</span>
            </div>
            <div className="text-right text-sm text-gray-300">{week.averages.calories}</div>
            <div className="text-right text-sm text-gray-300">{week.averages.fat}g</div>
            <div className="text-right text-sm text-gray-300">{week.averages.carbs}g</div>
            <div className="text-right text-sm text-gray-300">{week.averages.protein}g</div>
            <div className="flex gap-0.5 justify-end">
              <DotIndicator value={week.averages.calories} goal={data.goals.calories} type="under" />
              <DotIndicator value={week.averages.fat} goal={data.goals.fat} type="under" />
              <DotIndicator value={week.averages.carbs} goal={data.goals.carbs} type="under" />
              <DotIndicator value={week.averages.protein} goal={data.goals.protein} type="over" />
            </div>
          </div>
        ))}
      </div>

      {/* Year average */}
      {data.weeks.length > 1 && (
        <div className="border-t border-gray-800 pt-3">
          <div className="grid grid-cols-[1fr_60px_60px_60px_60px_30px] gap-1 items-center px-3 py-2">
            <div className="text-sm font-medium text-gray-200">Year Avg</div>
            <div className="text-right text-sm font-medium text-gray-200">
              {Math.round(data.weeks.reduce((s, w) => s + w.averages.calories, 0) / data.weeks.length)}
            </div>
            <div className="text-right text-sm font-medium text-gray-200">
              {Math.round(data.weeks.reduce((s, w) => s + w.averages.fat, 0) / data.weeks.length)}g
            </div>
            <div className="text-right text-sm font-medium text-gray-200">
              {Math.round(data.weeks.reduce((s, w) => s + w.averages.carbs, 0) / data.weeks.length)}g
            </div>
            <div className="text-right text-sm font-medium text-gray-200">
              {Math.round(data.weeks.reduce((s, w) => s + w.averages.protein, 0) / data.weeks.length)}g
            </div>
            <div />
          </div>
        </div>
      )}
    </div>
  );
}
