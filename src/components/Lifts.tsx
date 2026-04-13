"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  LineChart,
  ComposedChart,
} from "recharts";

type Category = "push" | "pull" | "legs" | "upper";
const CATEGORIES: Category[] = ["push", "pull", "legs", "upper"];
const CATEGORY_LABELS: Record<Category, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
};

interface Exercise {
  id: number;
  name: string;
  description: string;
  category: Category;
}

interface ExerciseSet {
  id: number;
  exercise_id: number;
  date: string;
  weight: number;
  reps: number;
  notes: string;
  created_at?: string;
}

function todayISO(): string {
  const tz = "America/New_York";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function Lifts() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [addingTo, setAddingTo] = useState<Category | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadExercises = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/exercises");
    if (res.ok) {
      const data = await res.json();
      setExercises(data.exercises);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const createExercise = async () => {
    if (!newName.trim() || !addingTo) return;
    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc.trim(),
        category: addingTo,
      }),
    });
    if (res.ok) {
      setNewName("");
      setNewDesc("");
      setAddingTo(null);
      await loadExercises();
    }
  };

  const cancelAdd = () => {
    setAddingTo(null);
    setNewName("");
    setNewDesc("");
  };

  const deleteExercise = async (id: number) => {
    if (!confirm("Delete this exercise and all of its sets?")) return;
    await fetch(`/api/exercises/${id}`, { method: "DELETE" });
    setSelected(null);
    await loadExercises();
  };

  if (selected) {
    return (
      <ExerciseDetail
        exercise={selected}
        onBack={() => setSelected(null)}
        onDelete={() => deleteExercise(selected.id)}
      />
    );
  }

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Loading...</div>;
  }

  const byCategory: Record<Category, Exercise[]> = {
    push: [],
    pull: [],
    legs: [],
    upper: [],
  };
  for (const e of exercises) {
    if (CATEGORIES.includes(e.category)) byCategory[e.category].push(e);
  }

  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => (
        <div key={cat} className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              {CATEGORY_LABELS[cat]}
              <span className="ml-2 text-gray-600">({byCategory[cat].length})</span>
            </div>
            <button
              onClick={() => setAddingTo(cat)}
              className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded"
            >
              + New
            </button>
          </div>

          {addingTo === cat && (
            <div className="bg-gray-900 rounded-lg p-3 space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Exercise name (e.g. Barbell back squat)"
                className="w-full bg-gray-800 rounded p-2 text-sm"
                autoFocus
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description / form cues / setup notes"
                rows={3}
                className="w-full bg-gray-800 rounded p-2 text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={createExercise}
                  disabled={!newName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded py-2 text-sm font-medium"
                >
                  Create
                </button>
                <button
                  onClick={cancelAdd}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 rounded py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {byCategory[cat].length === 0 && addingTo !== cat ? (
            <div className="text-gray-600 text-xs italic pl-1">No {CATEGORY_LABELS[cat].toLowerCase()} exercises yet</div>
          ) : (
            byCategory[cat].map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className="w-full text-left bg-gray-900 hover:bg-gray-800 rounded-lg p-3 transition-colors"
              >
                <div className="font-medium text-sm">{e.name}</div>
                {e.description && (
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{e.description}</div>
                )}
              </button>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function ExerciseDetail({
  exercise,
  onBack,
  onDelete,
}: {
  exercise: Exercise;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [adding, setAdding] = useState(false);

  const loadSets = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/exercises/${exercise.id}/sets`);
    if (res.ok) {
      const data = await res.json();
      setSets(data.sets);
    }
    setLoading(false);
  }, [exercise.id]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const addSet = async () => {
    const w = Number(weight);
    const r = Number(reps);
    if (!w || !r) return;
    setAdding(true);
    const res = await fetch(`/api/exercises/${exercise.id}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, weight: w, reps: r }),
    });
    if (res.ok) {
      setWeight("");
      setReps("");
      await loadSets();
    }
    setAdding(false);
  };

  const deleteSet = async (id: number) => {
    await fetch(`/api/sets/${id}`, { method: "DELETE" });
    await loadSets();
  };

  // Build chart data: each set is a point. x = days since first set, y = weight, z = reps (dot size)
  // Use ms timestamp on x for proper time scaling.
  const chartData = sets.map((s) => ({
    ts: new Date(s.date + "T12:00:00").getTime(),
    weight: s.weight,
    reps: s.reps,
    date: s.date,
  }));

  // Compute top set per day for the trend line
  const topPerDay = new Map<string, { ts: number; weight: number }>();
  for (const s of sets) {
    const cur = topPerDay.get(s.date);
    if (!cur || s.weight > cur.weight) {
      topPerDay.set(s.date, { ts: new Date(s.date + "T12:00:00").getTime(), weight: s.weight });
    }
  }
  const topLineData = Array.from(topPerDay.values()).sort((a, b) => a.ts - b.ts);

  // Group sets by date for the bottom list (newest first)
  const grouped = new Map<string, ExerciseSet[]>();
  for (const s of sets) {
    if (!grouped.has(s.date)) grouped.set(s.date, []);
    grouped.get(s.date)!.push(s);
  }
  const groupedSorted = Array.from(grouped.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  // Domain for X axis
  const tsValues = chartData.map((d) => d.ts);
  const xDomain: [number, number] | undefined =
    tsValues.length > 0 ? [Math.min(...tsValues), Math.max(...tsValues)] : undefined;

  // Reps range for ZAxis (dot size)
  const repsValues = chartData.map((d) => d.reps);
  const minReps = repsValues.length > 0 ? Math.min(...repsValues) : 1;
  const maxReps = repsValues.length > 0 ? Math.max(...repsValues) : 12;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-gray-200 text-xl leading-none"
          aria-label="Back"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{exercise.name}</div>
          {exercise.description && (
            <div className="text-xs text-gray-500 mt-1">{exercise.description}</div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-400"
        >
          Delete
        </button>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 rounded-lg p-3 h-64">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-600 text-sm">
            No sets logged yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={[]} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={xDomain || ["auto", "auto"]}
                stroke="#6b7280"
                fontSize={10}
                tickFormatter={(t) => {
                  const d = new Date(t);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis dataKey="weight" type="number" stroke="#6b7280" fontSize={11} domain={["auto", "auto"]} />
              <ZAxis dataKey="reps" type="number" range={[40, 400]} domain={[minReps, maxReps]} />
              <Tooltip
                cursor={{ stroke: "#374151" }}
                contentStyle={{ background: "#111827", border: "1px solid #374151", fontSize: 12 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                      <div className="text-gray-400">{p.date}</div>
                      <div className="text-white font-medium">
                        {p.weight} × {p.reps}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                data={topLineData}
                dataKey="weight"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Scatter data={chartData} fill="#a855f7" fillOpacity={0.7} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Add set */}
      <div className="bg-gray-900 rounded-lg p-3 space-y-2">
        <div className="text-xs text-gray-500 uppercase tracking-wide">Add set</div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-gray-400">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full bg-gray-800 rounded p-2 text-sm text-white mt-1"
            />
          </label>
          <label className="text-xs text-gray-400">
            Weight
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="lbs"
              className="block w-full bg-gray-800 rounded p-2 text-sm text-white mt-1"
            />
          </label>
          <label className="text-xs text-gray-400">
            Reps
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="reps"
              className="block w-full bg-gray-800 rounded p-2 text-sm text-white mt-1"
            />
          </label>
        </div>
        <button
          onClick={addSet}
          disabled={!weight || !reps || adding}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded py-2 text-sm font-medium"
        >
          {adding ? "Adding..." : "Add set"}
        </button>
      </div>

      {/* Sets history */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-gray-500 text-center py-4 text-sm">Loading...</div>
        ) : groupedSorted.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-4">No sets yet</div>
        ) : (
          groupedSorted.map(([d, daySets]) => (
            <div key={d} className="bg-gray-900 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-2">{d}</div>
              <div className="space-y-1">
                {daySets.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <span>
                      <span className="font-medium">{s.weight}</span>
                      <span className="text-gray-500"> × </span>
                      <span className="font-medium">{s.reps}</span>
                    </span>
                    <button
                      onClick={() => deleteSet(s.id)}
                      className="text-xs text-gray-600 hover:text-red-400"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
