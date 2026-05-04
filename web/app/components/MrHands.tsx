"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect } from "react";

const SUGGESTED = [
  "What's a trifecta?",
  "Why are we skipping R6?",
  "What's the Derby pick and why?",
  "Explain morning line vs live odds",
  "What's a public trap?",
];

// Static fallbacks — used if the LLM API is down. Keys are matched against
// lowercased user input via includes().
const FALLBACKS: Array<{ keys: string[]; answer: string }> = [
  {
    keys: ["trifecta"],
    answer:
      "A trifecta is when you pick the 1st, 2nd, and 3rd-place horses in exact finishing order. A 'box' covers all orderings of those horses (more combos, more cost, more coverage). A 'key' anchors one horse in a specific slot and spreads other horses around it.",
  },
  {
    keys: ["superfecta", "super "],
    answer:
      "A superfecta is picking 1st through 4th in exact order. The Super Hi-5 is 1st through 5th — massive payouts but very hard to hit. We use $0.10 base on Hi-5s to keep cost manageable.",
  },
  {
    keys: ["morning line", " ml ", "morning-line", "live odds"],
    answer:
      "Morning line (ML) is the track's pre-race odds estimate, set the day before. Live odds change by the second based on what the public is actually betting. When live odds drift IN sharply (shorter than ML), it's smart money; when they drift OUT, the public is abandoning the horse.",
  },
  {
    keys: ["public trap", "trap"],
    answer:
      "A public trap is a horse the public is overbetting based on glamour — famous trainer, famous jockey, easy-to-say name, post position superstition. The horse is shorter odds than they should be. We FADE these (don't bet them).",
  },
  {
    keys: ["overlay"],
    answer:
      "An overlay is a horse the algo thinks should be SHORTER odds than it actually is. Public is ignoring it — that's value. We KEY overlays in our tickets.",
  },
  {
    keys: ["chalk"],
    answer:
      "Chalk = the favorite, the horse the public is betting most. 'Chalk match' means our algo agrees with the public on the top 2. When we agree, there's no edge — we skip those races.",
  },
  {
    keys: ["why skip", "why are we skipping", "skipping r6", "skip r6"],
    answer:
      "R6 is a 'chalk match' race — our top picks (#2, #4, #6) match the public's top picks. When we agree with the public, we have no edge. Plus Tamara already has $21 keyed on #2 across three R6 trifectas, so adding more doubles risk on the same race. We're saving the bankroll for R12 (the Derby), which is the bigger EV play.",
  },
  {
    keys: ["derby", "r12"],
    answer:
      "R12 is the Kentucky Derby (post 6:57 PM ET). Our 'Smart Derby' ticket fades public traps (#1 Renegade, #6 Commandment) and keys data-strongest horses (#12 Chief Wallabee, #18 Further Ado — highest Beyer 105 + Prime Power 150.7). It's the biggest EV play of the day — concentrate your bankroll here.",
  },
  {
    keys: ["pace meltdown", "meltdown", "speed duel"],
    answer:
      "A pace meltdown happens when too many speed horses fight for the lead, burn each other out, and a closer (late-running horse) sweeps past late. We flag this with the SPEED_DUEL angle — and key the OVERLAY_CLOSER (a closer the public is overlooking).",
  },
  {
    keys: ["henery", "position prob", "p1", "p2"],
    answer:
      "We use Henery's formula (Lo & Bacon-Shone 2008) for position probabilities — the standard Harville formula overstates favorites in 2nd/3rd. Henery uses γ=0.81 (2nd), δ=0.65 (3rd), ε=0.55 (4th). The 'P(1st)' through 'P(4th)' columns sum to 1.0 across the field.",
  },
  {
    keys: ["box"],
    answer:
      "A 'box' covers every possible order of the horses you pick. Boxing 3 horses in a trifecta = 6 combos (3! = 6). Boxing 5 horses in a Hi-5 = 120 combos. Boxes are safer (you don't have to predict order) but cost more.",
  },
  {
    keys: ["key", "wheel"],
    answer:
      "A 'key' anchors one horse in a specific slot, then spreads other horses around it. Cheaper than a box and lets you express conviction — 'I think #2 wins, then any of these underneath.' A 'part-wheel' is a key with a specific list of horses in each slot (instead of all of them).",
  },
];

function findFallback(text: string): string | null {
  const lower = text.toLowerCase();
  for (const f of FALLBACKS) {
    if (f.keys.some((k) => lower.includes(k))) return f.answer;
  }
  return null;
}

export default function MrHands() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [staticReplies, setStaticReplies] = useState<
    Array<{ id: string; role: "user" | "assistant"; text: string }>
  >([]);
  const [apiDown, setApiDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: () => setApiDown(true),
  });
  const isStreaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, staticReplies, open]);

  function send(text: string) {
    if (!text.trim() || isStreaming) return;
    if (apiDown) {
      const id = String(Date.now());
      const fallback = findFallback(text);
      setStaticReplies((s) => [
        ...s,
        { id: id + "u", role: "user", text },
        {
          id: id + "a",
          role: "assistant",
          text:
            fallback ??
            "I'm running on static fallback right now (the AI brain is offline — Jason needs to refresh the API key). Try asking about: trifecta, superfecta, morning line, public trap, overlay, chalk, why skip R6, the Derby pick, pace meltdown, or position probabilities.",
        },
      ]);
      setInput("");
      return;
    }
    sendMessage({ text });
    setInput("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  // Combined message list for rendering
  const renderMessages = apiDown
    ? staticReplies
    : messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        text: m.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join(""),
      }));

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-5 py-3 rounded-full shadow-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-base border-2 border-amber-200/60"
        aria-label="Open Mr. Hands"
      >
        <span className="text-2xl leading-none">🐴</span>
        <span>Ask Mr. Hands</span>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-7rem))] flex flex-col rounded-2xl border-2 border-amber-500/60 bg-zinc-950/97 backdrop-blur shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="Mr. Hands the horse BOT"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-700/40 bg-gradient-to-r from-amber-950 to-zinc-900">
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">🐴</span>
              <div>
                <div className="text-sm font-black text-amber-300">Mr. Hands</div>
                <div className="text-[10px] text-amber-400/70">
                  the horse BOT · {apiDown ? "static FAQ mode" : "Derby Day"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white text-xl leading-none px-2"
              aria-label="Close Mr. Hands"
            >
              ×
            </button>
          </div>

          {apiDown && (
            <div className="bg-rose-950/40 border-b border-rose-800/40 px-3 py-2 text-[11px] text-rose-200">
              ⚠️ AI brain offline — running on static FAQ. Ask about: trifecta, overlay, public
              trap, chalk, why skip R6, the Derby pick, etc.
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
            {renderMessages.length === 0 && (
              <div className="text-zinc-300 text-sm leading-relaxed space-y-3">
                <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-3">
                  <p className="font-bold text-amber-200 mb-1">Howdy 🐴</p>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    I&apos;m <span className="font-bold text-amber-200">Mr. Hands</span>, the
                    horse BOT. I&apos;ll explain anything on this page in plain English — picks,
                    odds, jargon, why we&apos;re skipping a race.
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                    Try asking:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="text-left text-xs px-3 py-2 rounded bg-zinc-900 border border-zinc-800 hover:border-amber-600/50 hover:bg-zinc-800 text-zinc-300"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {renderMessages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`max-w-[88%] rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed ${
                    isUser
                      ? "ml-auto bg-emerald-700/40 text-emerald-50 border border-emerald-600/40"
                      : "mr-auto bg-zinc-800/80 text-zinc-100 border border-zinc-700/60"
                  }`}
                >
                  {!isUser && <span className="text-amber-400 mr-1">🐴</span>}
                  {m.text}
                </div>
              );
            })}
            {isStreaming && (
              <div className="mr-auto text-xs text-amber-400/70 italic">Mr. Hands is thinking…</div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-zinc-800 bg-zinc-900 p-2 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStreaming ? "Hold up, thinking…" : "Ask Mr. Hands anything…"}
              disabled={isStreaming}
              className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-black text-sm font-black"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
