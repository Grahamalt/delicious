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
  onMealLogged,
}: {
  onMealLogged: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from localStorage, clear if it's a new day
  useEffect(() => {
    const saved = localStorage.getItem("chat_messages");
    const savedDate = localStorage.getItem("chat_date");
    const today = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });

    if (saved && savedDate === today) {
      setMessages(JSON.parse(saved));
    } else {
      localStorage.removeItem("chat_messages");
      localStorage.setItem("chat_date", today);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chat_messages", JSON.stringify(messages));
      localStorage.setItem("chat_date", new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  }, [input]);

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
      <div className="flex-1 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-2xl font-semibold text-gray-300 mb-2">Delicious</div>
            <div className="text-gray-500 text-sm">
              Tell me what you ate and I&apos;ll log it.
              <br />
              Ask me about strategy, meal ideas, or macro advice.
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div className="flex justify-end mb-4 px-2">
                <div className="bg-gray-700/60 rounded-3xl px-4 py-2.5 max-w-[85%] text-[15px] text-gray-100">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="mb-4 px-2">
                <div className="prose prose-invert prose-sm max-w-none text-[15px] leading-relaxed text-gray-200">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.logged && msg.meal && (
                  <div className="mt-2 ml-0 inline-flex items-center gap-1.5 bg-green-900/30 border border-green-800/40 rounded-full px-3 py-1 text-xs text-green-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Logged: {msg.meal.description} ({msg.meal.calories} cal, {msg.meal.fat}f, {msg.meal.carbs}c, {msg.meal.protein}p)
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="mb-4 px-2">
            <div className="flex items-center gap-1 text-gray-400">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="pb-2 pt-2">
        <div className="relative flex items-end bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2">
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
            placeholder="Message"
            rows={1}
            className="flex-1 bg-transparent text-[15px] resize-none focus:outline-none placeholder-gray-500 text-gray-100 max-h-[150px]"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="ml-2 shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white disabled:bg-gray-600 disabled:text-gray-400 text-black transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
