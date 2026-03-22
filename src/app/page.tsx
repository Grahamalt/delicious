"use client";

import { useState, useEffect, useCallback } from "react";
import Chat from "@/components/Chat";
import WeekTable from "@/components/WeekTable";
import Notes from "@/components/Notes";
import Trends from "@/components/Trends";
import { WeekData } from "@/lib/sheets";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"chat" | "data" | "trends" | "notes">("chat");
  const [weekData, setWeekData] = useState<WeekData | null>(null);

  const fetchWeekData = useCallback(async () => {
    try {
      const res = await fetch("/api/sheets");
      if (res.ok) {
        const data = await res.json();
        setWeekData(data);
      }
    } catch {
      // silently fail, will retry
    }
  }, []);

  useEffect(() => {
    fetchWeekData();
  }, [fetchWeekData]);

  return (
    <div className="h-screen flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h1 className="text-lg font-bold">Delicious</h1>
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              activeTab === "chat"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => {
              setActiveTab("data");
              fetchWeekData();
            }}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              activeTab === "data"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setActiveTab("trends")}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              activeTab === "trends"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Trends
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              activeTab === "notes"
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Notes
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-3">
        {activeTab === "chat" ? (
          <Chat onMealLogged={fetchWeekData} />
        ) : activeTab === "data" ? (
          <div className="h-full overflow-y-auto">
            <WeekTable data={weekData} />
          </div>
        ) : activeTab === "trends" ? (
          <div className="h-full overflow-y-auto">
            <Trends />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <Notes />
          </div>
        )}
      </div>
    </div>
  );
}
