"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { sampleRace, getSimulationResults, getPaceScenario } from "./lib/data";

type Tab = "chat" | "card" | "predictions" | "pace";

const styleColors: Record<string, string> = {
  E: "bg-red-500/20 text-red-400 border-red-500/30",
  EP: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  P: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  S: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-green-500/20 text-green-400 border-green-500/30",
};

function Badge({ style }: { style: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styleColors[style] ?? "bg-zinc-700 text-zinc-300"}`}
    >
      {style}
    </span>
  );
}

const SUGGESTIONS = [
  "Analyze Saratoga race 5 — who benefits from the pace scenario?",
  "What are the top exacta and trifecta combinations for today's card at Churchill Downs?",
  "Explain the Benter odds-offset model and how it finds value",
  "I have an 8-horse field with 3 early speed types. How does that change the race?",
  "Compare lone speed vs speed duel scenarios — when do closers win?",
  "What should I look for in a class dropper at Keeneland?",
];

function getMessageText(m: { parts?: Array<{ type: string; text?: string }>; content?: string }): string {
  if (m.parts) {
    return m.parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
  }
  return typeof m.content === "string" ? m.content : "";
}

function ChatTab() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Ask HorseGPT anything</h2>
              <p className="text-zinc-400 max-w-lg">
                Type a race query like &quot;Saratoga race 5 today&quot; or ask about
                handicapping strategy, pace scenarios, exotic bets, or any track.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-left p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-3xl rounded-lg px-4 py-3 ${
                m.role === "user"
                  ? "bg-emerald-600/20 border border-emerald-600/30 text-zinc-100"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-200"
              }`}
            >
              {m.role === "assistant" && (
                <div className="text-xs text-emerald-400 font-semibold mb-1">
                  HorseGPT
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {getMessageText(m)}
              </div>
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
              <div className="text-xs text-emerald-400 font-semibold mb-1">
                HorseGPT
              </div>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mx-auto max-w-2xl p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <strong>Error:</strong> {error.message}
            {error.message.includes("API key") && (
              <p className="mt-2 text-zinc-400">
                Add your <code className="bg-zinc-800 px-1 rounded">ANTHROPIC_API_KEY</code> to{" "}
                Vercel Environment Variables (Project Settings &rarr; Environment Variables).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask about any race, track, horse, or handicapping strategy..."
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {isStreaming ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

function RaceCard() {
  const race = sampleRace;
  return (
    <div>
      <div className="mb-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            ["Track", race.track], ["Race", `R${race.raceNumber}`], ["Type", race.raceType],
            ["Distance", race.distance], ["Surface", race.surface],
            ["Purse", `$${race.purse.toLocaleString()}`], ["Condition", race.condition],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="text-zinc-500">{label}</span>
              <p className="font-semibold text-lg">{value}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-3">Sample race from test fixtures (SAR R5, 8-horse ALW field)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              {["PP", "Horse", "Jockey", "Trainer", "ML", "Style", "Speed", "E1", "LP"].map((h) => (
                <th key={h} className="py-3 px-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {race.entries.map((e) => (
              <tr key={e.pp} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                <td className="py-3 px-3 font-mono text-zinc-400">{e.pp}</td>
                <td className="py-3 px-3 font-semibold">{e.name}</td>
                <td className="py-3 px-3 text-zinc-300">{e.jockey}</td>
                <td className="py-3 px-3 text-zinc-300">{e.trainer}</td>
                <td className="py-3 px-3 font-mono">{e.mlOdds}/1</td>
                <td className="py-3 px-3"><Badge style={e.style} /></td>
                <td className="py-3 px-3 text-center font-mono">{e.speed}</td>
                <td className="py-3 px-3 text-center font-mono">{e.e1Pace}</td>
                <td className="py-3 px-3 text-center font-mono">{e.latePace}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Predictions() {
  const results = useMemo(() => getSimulationResults(sampleRace.entries), []);
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-1">Win / Place / Show</h3>
        <p className="text-xs text-zinc-500 mb-3">Henery normal model, 100K Monte Carlo sims with probit transform</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                {["Horse", "ML", "Style", "Win %", "Place %", "Show %", ""].map((h) => (
                  <th key={h} className="py-3 px-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.predictions.map((p) => (
                <tr key={p.name} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-3 px-3 font-semibold">{p.name}</td>
                  <td className="py-3 px-3 font-mono">{p.mlOdds}/1</td>
                  <td className="py-3 px-3"><Badge style={p.style} /></td>
                  <td className="py-3 px-3 font-mono font-semibold">{p.winPct.toFixed(1)}%</td>
                  <td className="py-3 px-3 font-mono text-zinc-300">{p.placePct.toFixed(1)}%</td>
                  <td className="py-3 px-3 font-mono text-zinc-400">{p.showPct.toFixed(1)}%</td>
                  <td className="py-3 px-3 w-32">
                    <div className="w-full bg-zinc-800 rounded-full h-2.5">
                      <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${Math.min(p.winPct * 2.5, 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-3">Top 10 Exactas</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-zinc-400"><th className="py-2 px-3 text-left">1st</th><th className="py-2 px-3 text-left">2nd</th><th className="py-2 px-3 text-right">Prob %</th></tr></thead>
            <tbody>{results.exactas.map((e, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/50"><td className="py-2 px-3">{e.first}</td><td className="py-2 px-3 text-zinc-300">{e.second}</td><td className="py-2 px-3 text-right font-mono">{e.prob.toFixed(2)}%</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-3">Top 10 Trifectas</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-zinc-400"><th className="py-2 px-3 text-left">1st</th><th className="py-2 px-3 text-left">2nd</th><th className="py-2 px-3 text-left">3rd</th><th className="py-2 px-3 text-right">Prob %</th></tr></thead>
            <tbody>{results.trifectas.map((t, i) => (
              <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/50"><td className="py-2 px-3">{t.first}</td><td className="py-2 px-3 text-zinc-300">{t.second}</td><td className="py-2 px-3 text-zinc-400">{t.third}</td><td className="py-2 px-3 text-right font-mono">{t.prob.toFixed(3)}%</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PaceAnalysis() {
  const pace = useMemo(() => getPaceScenario(sampleRace.entries), []);
  const scenarioColor: Record<string, string> = {
    "Speed Duel": "text-red-400", "Contested Pace": "text-orange-400",
    "Lone Speed": "text-emerald-400", "No Speed": "text-blue-400",
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-zinc-900 border border-zinc-800">
        <h3 className={`text-2xl font-bold mb-2 ${scenarioColor[pace.scenario] ?? "text-zinc-100"}`}>{pace.scenario}</h3>
        <p className="text-zinc-400 mb-4">{pace.description}</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded bg-red-500/10 border border-red-500/20">
            <div className="text-2xl font-bold text-red-400">{pace.earlyCount}</div>
            <div className="text-xs text-zinc-400 mt-1">Early Speed</div>
          </div>
          <div className="text-center p-3 rounded bg-yellow-500/10 border border-yellow-500/20">
            <div className="text-2xl font-bold text-yellow-400">{pace.presserCount}</div>
            <div className="text-xs text-zinc-400 mt-1">Pressers</div>
          </div>
          <div className="text-center p-3 rounded bg-green-500/10 border border-green-500/20">
            <div className="text-2xl font-bold text-green-400">{pace.closerCount}</div>
            <div className="text-xs text-zinc-400 mt-1">Closers</div>
          </div>
        </div>
      </div>
      <h3 className="text-lg font-semibold">Pace Impact by Horse</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-zinc-800 text-zinc-400">
            {["PP", "Horse", "Style", "E1", "LP", "Impact", "Analysis"].map((h) => (
              <th key={h} className="py-3 px-3 text-left">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {sampleRace.entries.map((e) => {
              const isSpeed = ["E", "EP"].includes(e.style);
              const isCloser = ["S", "C"].includes(e.style);
              const benefit = pace.earlyCount >= 3 ? (isCloser ? "positive" : isSpeed ? "negative" : "neutral")
                : (pace.earlyCount === 1 && isSpeed ? "positive" : "neutral");
              const icon = benefit === "positive" ? "+" : benefit === "negative" ? "-" : "=";
              const color = benefit === "positive" ? "text-emerald-400" : benefit === "negative" ? "text-red-400" : "text-zinc-400";
              let analysis = "";
              if (isSpeed && pace.earlyCount >= 3) analysis = "Speed duel. Likely to tire.";
              else if (isSpeed && pace.earlyCount === 1) analysis = "Lone speed. Can control pace.";
              else if (isSpeed && pace.earlyCount === 2) analysis = "Contested. Will duel with one other.";
              else if (isCloser && pace.earlyCount >= 3) analysis = "Speed collapse likely. Prime closer.";
              else if (isCloser && pace.earlyCount <= 1) analysis = "Soft pace. May not get setup.";
              else analysis = "Tactical. Can adjust to pace flow.";
              return (
                <tr key={e.pp} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-3 px-3 font-mono text-zinc-400">{e.pp}</td>
                  <td className="py-3 px-3 font-semibold">{e.name}</td>
                  <td className="py-3 px-3"><Badge style={e.style} /></td>
                  <td className="py-3 px-3 text-center font-mono">{e.e1Pace}</td>
                  <td className="py-3 px-3 text-center font-mono">{e.latePace}</td>
                  <td className={`py-3 px-3 text-center text-lg font-bold ${color}`}>{icon}</td>
                  <td className="py-3 px-3 text-zinc-400 text-xs">{analysis}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("chat");

  const tabs: { id: Tab; label: string }[] = [
    { id: "chat", label: "Ask HorseGPT" },
    { id: "card", label: "Race Card" },
    { id: "predictions", label: "Predictions" },
    { id: "pace", label: "Pace Analysis" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">HorseGPT v3.14</h1>
            <p className="text-xs text-zinc-400">
              Multi-model handicapping &middot; 60+ tracks &middot; Benter + LightGBM + Monte Carlo
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500 hidden sm:block">
            <div>Benter Odds-Offset Logistic</div>
            <div>Henery Monte Carlo (Probit)</div>
          </div>
        </div>
      </header>

      <nav className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
        {tab === "chat" && <ChatTab />}
        {tab === "card" && <RaceCard />}
        {tab === "predictions" && <Predictions />}
        {tab === "pace" && <PaceAnalysis />}
      </main>

      <footer className="border-t border-zinc-800 py-3 text-center text-xs text-zinc-500">
        HorseGPT v3.14 &middot; 60+ tracks &middot; Benter Odds-Offset + LightGBM Ensemble &middot; Henery Monte Carlo
      </footer>
    </div>
  );
}
