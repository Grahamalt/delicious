"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  logged?: boolean;
  meal?: {
    description: string;
    calories: number;
    fat: number;
    carbs: number;
    protein: number;
  };
}

export default function Chat({
  password,
  onMealLogged,
}: {
  password: string;
  onMealLogged: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-password": password,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: data.message,
        logged: data.logged,
        meal: data.meal,
      };
      setMessages([...newMessages, assistantMsg]);

      if (data.logged) {
        onMealLogged();
      }
    } catch (err) {
      const errorMsg: Message = {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.length === 0 && (
          <div className="text-gray-500 text-sm text-center py-8">
            Tell me what you ate and I&apos;ll estimate the macros and log it.
            <br />
            <span className="text-gray-600">
              e.g. &quot;I had 2 eggs and toast for breakfast&quot;
            </span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-200"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.logged && msg.meal && (
                <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-green-400">
                  Logged: {msg.meal.description} ({msg.meal.calories} cal,{" "}
                  {msg.meal.fat}f, {msg.meal.carbs}c, {msg.meal.protein}p)
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-400">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="What did you eat?"
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
