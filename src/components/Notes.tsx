"use client";

import { useState, useEffect } from "react";

export default function Notes({ password }: { password: string }) {
  const [notes, setNotes] = useState<string[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/notes", {
      headers: { "x-app-password": password },
    })
      .then((r) => r.json())
      .then((data) => {
        setNotes(data.notes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [password]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    const updated = [...notes, newNote.trim()];
    setNotes(updated);
    setNewNote("");
    setSaving(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-password": password,
      },
      body: JSON.stringify({ notes: updated }),
    });
    setSaving(false);
  };

  const removeNote = async (index: number) => {
    const updated = notes.filter((_, i) => i !== index);
    setNotes(updated);
    setSaving(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-password": password,
      },
      body: JSON.stringify({ notes: updated }),
    });
    setSaving(false);
  };

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        These goals and notes are included in every chat so the AI always knows
        your preferences.
      </p>

      {/* Existing notes */}
      <div className="space-y-2">
        {notes.length === 0 && (
          <div className="text-gray-600 text-sm text-center py-4">
            No notes yet. Add your goals and preferences below.
          </div>
        )}
        {notes.map((note, i) => (
          <div
            key={i}
            className="flex items-start gap-2 bg-gray-900 rounded-lg p-3"
          >
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

      {/* Add new note */}
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
          placeholder="e.g. More protein on weight days, limit fat to 30g at lunch..."
          rows={2}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
        />
        <button
          onClick={addNote}
          disabled={!newNote.trim() || saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium self-end transition-colors"
        >
          Add
        </button>
      </div>

      {saving && (
        <div className="text-xs text-gray-500 text-center">Saving...</div>
      )}
    </div>
  );
}
