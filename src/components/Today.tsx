"use client";

import { useState, useEffect, useCallback } from "react";

interface DailyEntry {
  date: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  description: string;
  source: string;
}

interface Goals {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

function MacroRow({
  label,
  value,
  goal,
  unit,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min((value / goal) * 100, 120);
  const over = value > goal;
  const remaining = goal - value;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-sm">
          <span className="font-medium">{value}</span>
          <span className="text-gray-500">/{goal}{unit}</span>
          <span className={`ml-2 text-xs ${remaining < 0 ? "text-red-400" : "text-gray-500"}`}>
            {remaining >= 0 ? `${remaining}${unit} left` : `+${-remaining}${unit}`}
          </span>
        </span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${over ? "bg-red-400" : color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function Today({ refreshKey }: { refreshKey?: number }) {
  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DailyEntry | null>(null);
  const [today, setToday] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const tz = "America/New_York";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
    const todayStr = `${get("year")}-${get("month")}-${get("day")}`;
    setToday(todayStr);

    const res = await fetch(`/api/daily?date=${todayStr}`);
    if (res.ok) {
      const data = await res.json();
      setEntry(data.entry);
      setGoals(data.goals);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const startEdit = () => {
    setDraft(
      entry || {
        date: today,
        calories: 0,
        fat: 0,
        carbs: 0,
        protein: 0,
        description: "",
        source: "edit",
      }
    );
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    const res = await fetch("/api/daily", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, source: "edit" }),
    });
    if (res.ok) {
      setEditing(false);
      await load();
    }
  };

  const remove = async () => {
    if (!entry) return;
    if (!confirm("Delete today's entry?")) return;
    await fetch(`/api/daily?date=${today}`, { method: "DELETE" });
    setEntry(null);
    setEditing(false);
  };

  if (loading || !goals) {
    return <div className="text-gray-500 text-center py-8">Loading...</div>;
  }

  if (editing && draft) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 space-y-3">
        <div className="text-xs text-gray-500 uppercase tracking-wide">Edit Today</div>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="What did you eat today?"
          className="w-full bg-gray-800 rounded p-2 text-sm min-h-[80px]"
        />
        <div className="grid grid-cols-2 gap-2">
          {(["calories", "fat", "carbs", "protein"] as const).map((k) => (
            <label key={k} className="text-xs text-gray-400">
              {k}
              <input
                type="number"
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                className="block w-full bg-gray-800 rounded p-2 text-sm text-white mt-1"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            className="flex-1 bg-blue-600 hover:bg-blue-500 rounded py-2 text-sm font-medium"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex-1 bg-gray-800 hover:bg-gray-700 rounded py-2 text-sm"
          >
            Cancel
          </button>
          {entry && (
            <button
              onClick={remove}
              className="px-3 bg-red-900 hover:bg-red-800 rounded py-2 text-sm"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  const totals = entry || { calories: 0, fat: 0, carbs: 0, protein: 0, description: "" };

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Today</div>
          <div className="text-sm text-gray-300">{today}</div>
        </div>
        <button
          onClick={startEdit}
          className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded"
        >
          {entry ? "Edit" : "Log"}
        </button>
      </div>

      {entry ? (
        <>
          <div className="text-sm text-gray-300 italic">{totals.description || "—"}</div>
          <div className="space-y-2 pt-1">
            <MacroRow label="Calories" value={totals.calories} goal={goals.calories} unit="" color="bg-blue-500" />
            <MacroRow label="Fat" value={totals.fat} goal={goals.fat} unit="g" color="bg-yellow-500" />
            <MacroRow label="Carbs" value={totals.carbs} goal={goals.carbs} unit="g" color="bg-green-500" />
            <MacroRow label="Protein" value={totals.protein} goal={goals.protein} unit="g" color="bg-purple-500" />
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-600 py-4 text-center">
          Nothing logged for today yet.
        </div>
      )}
    </div>
  );
}
