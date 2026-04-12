"use client";

import { useState, useEffect } from "react";

interface Goals {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

export default function Settings({ onSaved }: { onSaved?: () => void }) {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [draft, setDraft] = useState<Goals>({ calories: 0, fat: 0, carbs: 0, protein: 0 });
  const [notes, setNotes] = useState<string[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingGoals, setSavingGoals] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [goalsMsg, setGoalsMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/notes").then((r) => r.json()),
    ])
      .then(([gData, nData]) => {
        setGoals(gData.goals);
        setDraft(gData.goals);
        setNotes(nData.notes || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const goalsDirty =
    goals &&
    (draft.calories !== goals.calories ||
      draft.fat !== goals.fat ||
      draft.carbs !== goals.carbs ||
      draft.protein !== goals.protein);

  const saveGoals = async () => {
    setSavingGoals(true);
    setGoalsMsg(null);
    const res = await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      const data = await res.json();
      setGoals(data.goals);
      setDraft(data.goals);
      setGoalsMsg("Saved");
      onSaved?.();
      setTimeout(() => setGoalsMsg(null), 2000);
    } else {
      setGoalsMsg("Save failed");
    }
    setSavingGoals(false);
  };

  const saveNotesList = async (list: string[]) => {
    setSavingNotes(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: list }),
    });
    setSavingNotes(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    const updated = [...notes, newNote.trim()];
    setNotes(updated);
    setNewNote("");
    await saveNotesList(updated);
  };

  const removeNote = async (i: number) => {
    const updated = notes.filter((_, idx) => idx !== i);
    setNotes(updated);
    await saveNotesList(updated);
  };

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Loading...</div>;
  }

  const macroField = (key: keyof Goals, label: string, unit: string) => (
    <label className="text-xs text-gray-400">
      {label}
      <div className="relative mt-1">
        <input
          type="number"
          value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
          className="block w-full bg-gray-800 rounded p-2 pr-8 text-sm text-white"
        />
        {unit && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {unit}
          </span>
        )}
      </div>
    </label>
  );

  return (
    <div className="space-y-6">
      {/* Goals section */}
      <div className="bg-gray-900 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Daily macro goals</div>
            <div className="text-xs text-gray-600">Targets shown across the app</div>
          </div>
          {goalsMsg && <span className="text-xs text-green-400">{goalsMsg}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {macroField("calories", "Calories", "")}
          {macroField("fat", "Fat", "g")}
          {macroField("carbs", "Carbs", "g")}
          {macroField("protein", "Protein", "g")}
        </div>

        <div className="flex gap-2">
          <button
            onClick={saveGoals}
            disabled={!goalsDirty || savingGoals}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded py-2 text-sm font-medium"
          >
            {savingGoals ? "Saving..." : "Save goals"}
          </button>
          {goalsDirty && goals && (
            <button
              onClick={() => setDraft(goals)}
              className="px-3 bg-gray-800 hover:bg-gray-700 rounded py-2 text-sm"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Notes section */}
      <div className="bg-gray-900 rounded-lg p-4 space-y-3">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Notes for the AI</div>
          <div className="text-xs text-gray-600">
            These are included in every chat so the assistant knows your preferences.
          </div>
        </div>

        <div className="space-y-2">
          {notes.length === 0 && (
            <div className="text-gray-600 text-sm text-center py-3">
              No notes yet. Add your goals and preferences below.
            </div>
          )}
          {notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 bg-gray-800 rounded-lg p-3">
              <span className="flex-1 text-sm text-gray-300">{note}</span>
              <button
                onClick={() => removeNote(i)}
                className="text-gray-600 hover:text-red-400 text-xs shrink-0"
              >
                remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addNote();
              }
            }}
            placeholder="e.g. More protein on weight days, limit fat at lunch..."
            rows={2}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
          />
          <button
            onClick={addNote}
            disabled={!newNote.trim() || savingNotes}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium self-end"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
