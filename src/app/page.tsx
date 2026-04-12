"use client";

import { useState } from "react";
import Chat from "@/components/Chat";
import Today from "@/components/Today";
import WeekChart from "@/components/WeekChart";
import Settings from "@/components/Settings";
import TrendsChart from "@/components/TrendsChart";
import Progress from "@/components/Progress";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"chat" | "today" | "week" | "trends" | "progress" | "settings">("chat");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  const tabBtn = (id: typeof activeTab, label: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-3 py-1 rounded-md text-sm transition-colors ${
        activeTab === id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-screen flex flex-col max-w-2xl mx-auto">
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h1 className="text-lg font-bold">Delicious</h1>
        <div className="flex bg-gray-800 rounded-lg p-0.5 flex-wrap">
          {tabBtn("chat", "Chat")}
          {tabBtn("today", "Today")}
          {tabBtn("week", "Week")}
          {tabBtn("trends", "Trends")}
          {tabBtn("progress", "Me")}
          {tabBtn("settings", "Settings")}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        {activeTab === "chat" ? (
          <Chat onMealLogged={refresh} />
        ) : activeTab === "today" ? (
          <div className="h-full overflow-y-auto">
            <Today refreshKey={refreshKey} />
          </div>
        ) : activeTab === "week" ? (
          <div className="h-full overflow-y-auto">
            <WeekChart refreshKey={refreshKey} />
          </div>
        ) : activeTab === "progress" ? (
          <div className="h-full overflow-y-auto">
            <Progress />
          </div>
        ) : activeTab === "trends" ? (
          <div className="h-full overflow-y-auto">
            <TrendsChart refreshKey={refreshKey} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <Settings onSaved={refresh} />
          </div>
        )}
      </div>
    </div>
  );
}
