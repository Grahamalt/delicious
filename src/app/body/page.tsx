'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BodyScan } from '@/types/body-tracking';
import BodyDashboard from '@/components/body-tracking/BodyDashboard';
import BodyScanForm from '@/components/body-tracking/BodyScanForm';

const API_BASE = '/api/body-scan';

type Tab = 'dashboard' | 'log';

export default function BodyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [scans, setScans] = useState<BodyScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScans(data.scans ?? []);
    } catch (err: any) {
      console.error('[BodyPage] Failed to fetch scans:', err);
      setError('Could not load scans. Using demo data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const handleScanSuccess = (newScan: BodyScan) => {
    setScans((prev) => {
      const exists = prev.findIndex((s) => s.date === newScan.date);
      if (exists !== -1) {
        const updated = [...prev];
        updated[exists] = newScan;
        return updated;
      }
      return [newScan, ...prev];
    });
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="sticky top-0 z-40 border-b border-neutral-900 bg-[#0f0f0f]/90 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="text-xl font-bold text-white">Body Tracking</h1>
          <p className="text-xs text-neutral-500">Progress over perfection</p>
        </div>

        <div className="mx-auto max-w-md px-4 pb-3">
          <div className="flex gap-1 rounded-xl bg-neutral-900 p-1">
            {(
              [
                { key: 'dashboard', label: 'Dashboard' },
                { key: 'log', label: 'Log Scan' },
              ] as { key: Tab; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={[
                  'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
                  activeTab === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-md px-4 py-5 pb-24">
        {activeTab === 'dashboard' && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            )}

            {!loading && error && (
              <div className="mb-4 rounded-xl bg-yellow-900/30 px-4 py-3 text-xs text-yellow-400">
                {error}
              </div>
            )}

            {!loading && (
              <BodyDashboard
                scans={scans}
                targetWeightLbs={155}
                targetWaistCm={78}
                targetShoulderCm={120}
              />
            )}
          </>
        )}

        {activeTab === 'log' && (
          <BodyScanForm onSuccess={handleScanSuccess} />
        )}
      </main>
    </div>
  );
}
