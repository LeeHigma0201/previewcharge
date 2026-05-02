"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";

export default function HorseGPT() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const isStreaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm border-2 border-emerald-300/40"
        aria-label="Open HorseGPT"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
        HorseGPT
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(560px,calc(100vh-7rem))] flex flex-col rounded-xl border border-emerald-700/60 bg-zinc-950/95 backdrop-blur shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="HorseGPT"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-white">HorseGPT</span>
              <span className="text-[10px] text-zinc-400">Derby Day · ask the algo anything</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white text-lg leading-none px-2"
              aria-label="Close HorseGPT"
            >
              ×
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-zinc-400 text-xs leading-relaxed">
                <p className="mb-1 font-semibold text-zinc-300">I&apos;m read-only. Ask me about today&apos;s card or the algo.</p>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-500">
                  <li>&ldquo;Why is R7 bettable but R8 a pass?&rdquo;</li>
                  <li>&ldquo;What's the chalk-overlap rule?&rdquo;</li>
                  <li>&ldquo;Top 4 in the Derby?&rdquo;</li>
                  <li>&ldquo;Why did you pass on R10?&rdquo;</li>
                </ul>
              </div>
            )}
            {messages.map((m) => {
              const text = m.parts
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("");
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap leading-snug ${
                    isUser
                      ? "ml-auto bg-emerald-700/40 text-emerald-50 border border-emerald-600/40"
                      : "mr-auto bg-zinc-800/80 text-zinc-100 border border-zinc-700/60"
                  }`}
                >
                  {text}
                </div>
              );
            })}
            {isStreaming && (
              <div className="mr-auto text-xs text-zinc-500 italic">HorseGPT is thinking…</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-zinc-800 bg-zinc-900 p-2 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? "Wait for response…" : "Ask HorseGPT…"}
              disabled={isStreaming}
              className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white text-sm font-bold"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
