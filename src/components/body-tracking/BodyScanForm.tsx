'use client';

// ============================================================
// BodyScanForm — Log a new body scan (measurements + photos)
// ============================================================

import { useState, useCallback } from 'react';
import type { BodyScanFormProps, CreateBodyScanInput, PhotoAngle, MeasurementUnit } from '@/types/body-tracking';
import BodyScanCapture from './BodyScanCapture';

const API_BASE = '/api/body-scan';

// Conversion helpers
const cmToInches = (cm: number) => +(cm / 2.54).toFixed(2);
const inchesToCm = (inches: number) => +(inches * 2.54).toFixed(2);

function fileToCompressedDataUrl(file: File, maxWidth = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxWidth / img.width, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas unsupported'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

async function uploadPhoto(file: File, _angle: PhotoAngle): Promise<string> {
  const dataUrl = await fileToCompressedDataUrl(file);
  const res = await fetch('/api/body-scan/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  const { url } = await res.json();
  return url as string;
}

// ── Main Component ────────────────────────────────────────────
export default function BodyScanForm({ onSuccess, initialData }: BodyScanFormProps) {
  const today = new Date().toISOString().split('T')[0];

  // Form state
  const [date, setDate] = useState(initialData?.date ?? today);
  const [weightLbs, setWeightLbs] = useState(
    initialData?.weightLbs?.toString() ?? '',
  );
  const [waistValue, setWaistValue] = useState('');
  const [waistUnit, setWaistUnit] = useState<MeasurementUnit>('cm');
  const [shoulderValue, setShoulderValue] = useState('');
  const [shoulderUnit, setShoulderUnit] = useState<MeasurementUnit>('cm');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [photos, setPhotos] = useState<Partial<Record<PhotoAngle, File>>>({});

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  // Unit toggle helper
  function makeUnitToggle(
    unit: MeasurementUnit,
    setUnit: (u: MeasurementUnit) => void,
    value: string,
    setValue: (v: string) => void,
  ) {
    return () => {
      const next: MeasurementUnit = unit === 'cm' ? 'inches' : 'cm';
      if (value) {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          setValue(
            next === 'inches'
              ? cmToInches(num).toString()
              : inchesToCm(num).toString(),
          );
        }
      }
      setUnit(next);
    };
  }

  const handleWaistUnitToggle = makeUnitToggle(waistUnit, setWaistUnit, waistValue, setWaistValue);
  const handleShoulderUnitToggle = makeUnitToggle(shoulderUnit, setShoulderUnit, shoulderValue, setShoulderValue);

  const handlePhotosChange = useCallback(
    (newPhotos: Partial<Record<PhotoAngle, File>>) => {
      setPhotos(newPhotos);
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError('Date is required.');
      return;
    }

    const weightNum = weightLbs ? parseFloat(weightLbs) : NaN;
    const weightLbsOut = !isNaN(weightNum) ? weightNum : null;

    const waistNum = waistValue ? parseFloat(waistValue) : NaN;
    const waistCm = !isNaN(waistNum)
      ? (waistUnit === 'inches' ? inchesToCm(waistNum) : waistNum)
      : null;

    const shoulderNum = shoulderValue ? parseFloat(shoulderValue) : NaN;
    const shoulderCm = !isNaN(shoulderNum)
      ? (shoulderUnit === 'inches' ? inchesToCm(shoulderNum) : shoulderNum)
      : null;

    const hasPhoto = Object.keys(photos).length > 0;
    if (weightLbsOut == null && waistCm == null && shoulderCm == null && !hasPhoto && !notes) {
      setError('Add at least one: weight, waist, shoulders, photo, or note.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload photos concurrently
      const photoUrls: Partial<Record<PhotoAngle, string>> = {};
      const uploadEntries = Object.entries(photos) as [PhotoAngle, File][];

      if (uploadEntries.length > 0) {
        const results = await Promise.allSettled(
          uploadEntries.map(([angle, file]) =>
            uploadPhoto(file, angle).then((url) => ({ angle, url })),
          ),
        );
        for (const result of results) {
          if (result.status === 'fulfilled') {
            photoUrls[result.value.angle] = result.value.url;
          } else {
            console.error('[BodyScanForm] Photo upload failed:', result.reason);
          }
        }
      }

      const payload: CreateBodyScanInput = {
        date,
        weightLbs: weightLbsOut,
        waistCm,
        shoulderCm,
        photoFrontUrl: photoUrls.front ?? initialData?.photoFrontUrl ?? null,
        photoSideLeftUrl: photoUrls.side_left ?? initialData?.photoSideLeftUrl ?? null,
        photoSideRightUrl: photoUrls.side_right ?? initialData?.photoSideRightUrl ?? null,
        photoBackUrl: photoUrls.back ?? initialData?.photoBackUrl ?? null,
        notes: notes || null,
      };

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const { scan } = await res.json();
      onSuccess?.(scan);

      // Reset form
      setWeightLbs('');
      setWaistValue('');
      setShoulderValue('');
      setNotes('');
      setPhotos({});
      setShowCapture(false);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-2xl bg-[#1a1a1a] p-5"
    >
      <h2 className="text-lg font-semibold text-white">Log Body Scan</h2>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={today}
          required
          className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Weight */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Weight
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.1"
            min="50"
            max="500"
            placeholder="157.5"
            value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 pl-4 pr-14 text-white placeholder:text-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
            lbs
          </span>
        </div>
      </div>

      {/* Waist */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Waist
          </label>
          <button
            type="button"
            onClick={handleWaistUnitToggle}
            className="flex rounded-lg border border-neutral-800 text-xs overflow-hidden"
          >
            <span
              className={`px-3 py-1 transition-colors ${
                waistUnit === 'cm'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-900 text-neutral-400'
              }`}
            >
              cm
            </span>
            <span
              className={`px-3 py-1 transition-colors ${
                waistUnit === 'inches'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-900 text-neutral-400'
              }`}
            >
              in
            </span>
          </button>
        </div>
        <div className="relative">
          <input
            type="number"
            step="0.1"
            min="40"
            max="200"
            placeholder={waistUnit === 'cm' ? '80.0' : '31.5'}
            value={waistValue}
            onChange={(e) => setWaistValue(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 pl-4 pr-16 text-white placeholder:text-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
            {waistUnit}
          </span>
        </div>
      </div>

      {/* Shoulders */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Shoulders{' '}
            <span className="normal-case text-neutral-600">(optional — for V-taper)</span>
          </label>
          <button
            type="button"
            onClick={handleShoulderUnitToggle}
            className="flex rounded-lg border border-neutral-800 text-xs overflow-hidden"
          >
            <span
              className={`px-3 py-1 transition-colors ${
                shoulderUnit === 'cm'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-900 text-neutral-400'
              }`}
            >
              cm
            </span>
            <span
              className={`px-3 py-1 transition-colors ${
                shoulderUnit === 'inches'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-900 text-neutral-400'
              }`}
            >
              in
            </span>
          </button>
        </div>
        <div className="relative">
          <input
            type="number"
            step="0.1"
            min="80"
            max="200"
            placeholder={shoulderUnit === 'cm' ? '115.0' : '45.5'}
            value={shoulderValue}
            onChange={(e) => setShoulderValue(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 pl-4 pr-16 text-white placeholder:text-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
            {shoulderUnit}
          </span>
        </div>
        <p className="text-xs text-neutral-600">
          Measure around the widest point of both shoulders (deltoids).
        </p>
      </div>

      {/* Photos toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowCapture(!showCapture)}
          className="flex w-full items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-300 transition-colors hover:border-neutral-700"
        >
          <span className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
              />
            </svg>
            Add progress photos
            {Object.keys(photos).length > 0 && (
              <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                {Object.keys(photos).length}
              </span>
            )}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform ${showCapture ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCapture && (
          <div className="mt-3">
            <BodyScanCapture
              onPhotosChange={handlePhotosChange}
              existingPhotos={{}}
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Notes <span className="text-neutral-600">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How are you feeling? Any changes to routine?"
          rows={3}
          className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-white placeholder:text-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Saving…' : 'Save Scan'}
      </button>
    </form>
  );
}
