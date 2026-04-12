"use client";

import { useState, useRef, useEffect } from "react";

interface DailyEntry {
  date: string;
  description: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
  logged?: boolean;
  removed?: boolean;
  intent?: "override" | "merge";
  entry?: DailyEntry;
}

function compressChatImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      const maxW = 800;
      const scale = Math.min(maxW / img.width, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function Chat({
  onMealLogged,
}: {
  onMealLogged: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load chat history from localStorage, clear if it's a new day
  useEffect(() => {
    const saved = localStorage.getItem("chat_messages");
    const savedDate = localStorage.getItem("chat_date");
    const today = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });

    if (saved && savedDate === today) {
      // Don't restore images from localStorage (too large)
      const parsed = JSON.parse(saved);
      setMessages(parsed.map((m: Message) => ({ ...m, image: undefined })));
    } else {
      localStorage.removeItem("chat_messages");
      localStorage.setItem("chat_date", today);
    }
  }, []);

  // Save messages to localStorage whenever they change (without images)
  useEffect(() => {
    if (messages.length > 0) {
      const toSave = messages.map((m) => ({ ...m, image: undefined }));
      localStorage.setItem("chat_messages", JSON.stringify(toSave));
      localStorage.setItem("chat_date", new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  }, [input]);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressChatImage(file);
    setImage(compressed);
  };

  const send = async () => {
    if ((!input.trim() && !image) || loading) return;

    const userMsg: Message = {
      role: "user",
      content: input.trim() || "What's in this meal? Estimate the calories and macros and log it.",
      image: image || undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
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
            ...(m.image ? { image: m.image } : {}),
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
        removed: data.removed,
        intent: data.intent,
        entry: data.entry || undefined,
      };
      setMessages([...newMessages, assistantMsg]);

      if (data.logged || data.removed) {
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
              Tell me what you ate, snap a photo, or ask for advice.
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div className="flex justify-end mb-4 px-2">
                <div className="bg-gray-700/60 rounded-3xl px-4 py-2.5 max-w-[85%] text-[15px] text-gray-100">
                  {msg.image && (
                    <img src={msg.image} alt="Food" className="rounded-xl mb-2 max-w-full max-h-48" />
                  )}
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="mb-4 px-2">
                <div className="prose prose-invert prose-sm max-w-none text-[15px] leading-relaxed text-gray-200">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.logged && msg.entry && (
                  <div className="mt-2 ml-0 inline-flex items-center gap-1.5 bg-green-900/30 border border-green-800/40 rounded-full px-3 py-1 text-xs text-green-400">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {msg.intent === "merge" ? "Merged" : "Logged"} {msg.entry.date}: {msg.entry.calories} cal / {msg.entry.fat}f / {msg.entry.carbs}c / {msg.entry.protein}p
                  </div>
                )}
                {msg.removed && (
                  <div className="mt-2 ml-0 inline-flex items-center gap-1.5 bg-red-900/30 border border-red-800/40 rounded-full px-3 py-1 text-xs text-red-400">
                    Removed daily entry
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

      {/* Image preview */}
      {image && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img src={image} alt="Preview" className="h-20 rounded-xl" />
            <button
              onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="absolute -top-1 -right-1 bg-gray-700 rounded-full w-5 h-5 flex items-center justify-center text-xs text-gray-300"
            >
              x
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="pb-2 pt-2">
        <div className="relative flex items-end bg-gray-800 border border-gray-700 rounded-2xl px-4 py-2">
          <label className="shrink-0 w-8 h-8 flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              className="hidden"
            />
          </label>
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
            className="flex-1 bg-transparent text-[15px] resize-none focus:outline-none placeholder-gray-500 text-gray-100 max-h-[150px] ml-1"
          />
          <button
            onClick={send}
            disabled={loading || (!input.trim() && !image)}
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
