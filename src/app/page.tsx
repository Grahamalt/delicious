"use client";

import { useState, useEffect, useCallback } from "react";
import Chat from "@/components/Chat";
import WeekTable from "@/components/WeekTable";
import Notes from "@/components/Notes";
import { WeekData } from "@/lib/sheets";

export default function Home() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "data" | "notes">("chat");
  const [weekData, setWeekData] = useState<WeekData | null>(null);

  const fetchWeekData = useCallback(async () => {
    if (!password) return;
    try {
      const res = await fetch("/api/sheets", {
        headers: { "x-app-password": password },
      });
      if (res.ok) {
        const data = await res.json();
        setWeekData(data);
      }
    } catch {
      // silently fail, will retry
    }
  }, [password]);

  useEffect(() => {
    // Check for saved password
    const saved = localStorage.getItem("ct_password");
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchWeekData();
    }
  }, [authenticated, fetchWeekData]);

  const login = () => {
    setPassword(passwordInput);
    localStorage.setItem("ct_password", passwordInput);
    setAuthenticated(true);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm">
          <h1 className="text-xl font-bold mb-4">Delicious</h1>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Password"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={login}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

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
          <Chat password={password} onMealLogged={fetchWeekData} />
        ) : activeTab === "data" ? (
          <div className="h-full overflow-y-auto">
            <WeekTable data={weekData} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <Notes password={password} />
          </div>
        )}
      </div>
    </div>
  );
}
