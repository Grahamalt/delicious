"use client";

import { useState, useEffect, useRef } from "react";

interface ProgressEntry {
  date: string;
  time: string;
  weight: number | null;
  photo: string | null;
  note: string;
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      // Resize to fit in a Google Sheets cell (max ~50K chars base64 ≈ ~36KB)
      const maxW = 400;
      const scale = Math.min(maxW / img.width, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.6;
      let result = canvas.toDataURL("image/jpeg", quality);
      // Keep reducing quality until it fits in a sheet cell
      while (result.length > 49000 && quality > 0.1) {
        quality -= 0.1;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.src = URL.createObjectURL(file);
  });
}

function WeightChart({ entries }: { entries: ProgressEntry[] }) {
  const withWeight = entries.filter((e) => e.weight !== null);
  if (withWeight.length < 2) return null;

  const weights = withWeight.map((e) => e.weight!);
  const min = Math.min(...weights) - 2;
  const max = Math.max(...weights) + 2;
  const range = max - min || 1;

  const w = 100;
  const h = 40;

  const points = withWeight.map((e, i) => {
    const x = (i / (withWeight.length - 1)) * w;
    const y = h - ((e.weight! - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="bg-gray-900 rounded-lg p-3 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500">Weight Trend</span>
        <span className="text-sm font-medium text-gray-300">
          {weights[weights.length - 1]} lbs
          {weights.length >= 2 && (
            <span className={`ml-1 text-xs ${
              weights[weights.length - 1] <= weights[0] ? "text-green-400" : "text-red-400"
            }`}>
              {weights[weights.length - 1] > weights[0] ? "+" : ""}
              {(weights[weights.length - 1] - weights[0]).toFixed(1)}
            </span>
          )}
        </span>
      </div>
      <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} className="w-full h-20">
        <polyline
          points={points}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {withWeight.map((e, i) => {
          const x = (i / (withWeight.length - 1)) * w;
          const y = h - ((e.weight! - min) / range) * h;
          return (
            <circle key={i} cx={x} cy={y} r="2" fill="#60a5fa" />
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <span>{withWeight[0].date}</span>
        <span>{withWeight[withWeight.length - 1].date}</span>
      </div>
    </div>
  );
}

export default function Progress() {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhoto(compressed);
  };

  const submit = async () => {
    if (!weight && !photo) return;
    setSaving(true);

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const entry: ProgressEntry = {
      date: `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`,
      time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      weight: weight ? Number(weight) : null,
      photo,
      note,
    };

    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });

      if (res.ok) {
        setEntries([...entries, entry]);
        setWeight("");
        setNote("");
        setPhoto(null);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        const err = await res.json();
        alert(`Failed to save: ${err.error || "Unknown error"}`);
      }
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : "Network error"}`);
    }

    setSaving(false);
  };

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Loading progress...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Weight chart */}
      <WeightChart entries={entries} />

      {/* Log new entry */}
      <div className="bg-gray-900 rounded-lg p-3 space-y-3">
        <div className="text-xs text-gray-500 uppercase tracking-wide">Log Progress</div>

        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Weight (lbs)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <label className="flex-1 flex items-center justify-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-pointer hover:border-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {photo ? "Photo added" : "Add photo"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              className="hidden"
            />
          </label>

          <button
            onClick={submit}
            disabled={saving || (!weight && !photo)}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? "Saving..." : "Log"}
          </button>
        </div>

        {photo && (
          <div className="relative w-20 h-20">
            <img src={photo} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
            <button
              onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="absolute -top-1 -right-1 bg-gray-700 rounded-full w-5 h-5 flex items-center justify-center text-xs text-gray-300"
            >
              x
            </button>
          </div>
        )}
      </div>

      {/* History */}
      <div className="space-y-2">
        {[...entries].reverse().map((entry, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-3 flex gap-3 items-start">
            {entry.photo && (
              <button onClick={() => setSelectedPhoto(entry.photo)}>
                <img
                  src={entry.photo}
                  alt="Progress"
                  className="w-16 h-16 object-cover rounded-lg shrink-0"
                />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {entry.date} {entry.time}
                </span>
                {entry.weight && (
                  <span className="text-sm font-medium text-gray-300">
                    {entry.weight} lbs
                  </span>
                )}
              </div>
              {entry.note && (
                <div className="text-xs text-gray-400 mt-1">{entry.note}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Photo modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <img
            src={selectedPhoto}
            alt="Progress"
            className="max-w-full max-h-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
