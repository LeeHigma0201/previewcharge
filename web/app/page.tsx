"use client";

import { useState, useMemo } from "react";
import { sampleRace, getSimulationResults, getPaceScenario } from "./lib/data";

type Tab = "card" | "predictions" | "pace" | "about";

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

function RaceCard() {
  const race = sampleRace;
  return (
    <div>
      <div className="mb-6 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-zinc-500">Track</span>
            <p className="font-semibold text-lg">{race.track}</p>
          </div>
          <div>
            <span className="text-zinc-500">Race</span>
            <p className="font-semibold text-lg">R{race.raceNumber}</p>
          </div>
          <div>
            <span className="text-zinc-500">Type</span>
            <p className="font-semibold text-lg">{race.raceType}</p>
          </div>
          <div>
            <span className="text-zinc-500">Distance</span>
            <p className="font-semibold text-lg">{race.distance}</p>
          </div>
          <div>
            <span className="text-zinc-500">Surface</span>
            <p className="font-semibold text-lg">{race.surface}</p>
          </div>
          <div>
            <span className="text-zinc-500">Purse</span>
            <p className="font-semibold text-lg">${race.purse.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-zinc-500">Condition</span>
            <p className="font-semibold text-lg">{race.condition}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="py-3 px-3 text-left">PP</th>
              <th className="py-3 px-3 text-left">Horse</th>
              <th className="py-3 px-3 text-left">Jockey</th>
              <th className="py-3 px-3 text-left">Trainer</th>
              <th className="py-3 px-3 text-center">ML</th>
              <th className="py-3 px-3 text-center">Style</th>
              <th className="py-3 px-3 text-center">Speed</th>
              <th className="py-3 px-3 text-center">E1</th>
              <th className="py-3 px-3 text-center">LP</th>
            </tr>
          </thead>
          <tbody>
            {race.entries.map((e) => (
              <tr key={e.pp} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                <td className="py-3 px-3 font-mono text-zinc-400">{e.pp}</td>
                <td className="py-3 px-3 font-semibold">{e.name}</td>
                <td className="py-3 px-3 text-zinc-300">{e.jockey}</td>
                <td className="py-3 px-3 text-zinc-300">{e.trainer}</td>
                <td className="py-3 px-3 text-center font-mono">{e.mlOdds}/1</td>
                <td className="py-3 px-3 text-center"><Badge style={e.style} /></td>
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
        <h3 className="text-lg font-semibold mb-3">Win / Place / Show Probabilities</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Henery normal model, 100K Monte Carlo simulations with probit transform
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-3 px-3 text-left">Horse</th>
                <th className="py-3 px-3 text-center">ML Odds</th>
                <th className="py-3 px-3 text-center">Style</th>
                <th className="py-3 px-3 text-right">Win %</th>
                <th className="py-3 px-3 text-right">Place %</th>
                <th className="py-3 px-3 text-right">Show %</th>
                <th className="py-3 px-3 text-left">Win Bar</th>
              </tr>
            </thead>
            <tbody>
              {results.predictions.map((p) => (
                <tr key={p.name} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-3 px-3 font-semibold">{p.name}</td>
                  <td className="py-3 px-3 text-center font-mono">{p.mlOdds}/1</td>
                  <td className="py-3 px-3 text-center"><Badge style={p.style} /></td>
                  <td className="py-3 px-3 text-right font-mono font-semibold">{p.winPct.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-right font-mono text-zinc-300">{p.placePct.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-right font-mono text-zinc-400">{p.showPct.toFixed(1)}%</td>
                  <td className="py-3 px-3">
                    <div className="w-full bg-zinc-800 rounded-full h-2.5">
                      <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(p.winPct * 2.5, 100)}%` }} />
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
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-2 px-3 text-left">1st</th>
                <th className="py-2 px-3 text-left">2nd</th>
                <th className="py-2 px-3 text-right">Prob %</th>
              </tr>
            </thead>
            <tbody>
              {results.exactas.map((e, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-2 px-3">{e.first}</td>
                  <td className="py-2 px-3 text-zinc-300">{e.second}</td>
                  <td className="py-2 px-3 text-right font-mono">{e.prob.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-3">Top 10 Trifectas</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-2 px-3 text-left">1st</th>
                <th className="py-2 px-3 text-left">2nd</th>
                <th className="py-2 px-3 text-left">3rd</th>
                <th className="py-2 px-3 text-right">Prob %</th>
              </tr>
            </thead>
            <tbody>
              {results.trifectas.map((t, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-2 px-3">{t.first}</td>
                  <td className="py-2 px-3 text-zinc-300">{t.second}</td>
                  <td className="py-2 px-3 text-zinc-400">{t.third}</td>
                  <td className="py-2 px-3 text-right font-mono">{t.prob.toFixed(3)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PaceAnalysis() {
  const pace = useMemo(() => getPaceScenario(sampleRace.entries), []);

  const scenarioColor: Record<string, string> = {
    "Speed Duel": "text-red-400",
    "Contested Pace": "text-orange-400",
    "Lone Speed": "text-emerald-400",
    "No Speed": "text-blue-400",
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-zinc-900 border border-zinc-800">
        <h3 className={`text-2xl font-bold mb-2 ${scenarioColor[pace.scenario] ?? "text-zinc-100"}`}>
          {pace.scenario}
        </h3>
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
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              <th className="py-3 px-3 text-left">PP</th>
              <th className="py-3 px-3 text-left">Horse</th>
              <th className="py-3 px-3 text-center">Style</th>
              <th className="py-3 px-3 text-center">E1 Pace</th>
              <th className="py-3 px-3 text-center">Late Pace</th>
              <th className="py-3 px-3 text-center">Impact</th>
              <th className="py-3 px-3 text-left">Analysis</th>
            </tr>
          </thead>
          <tbody>
            {sampleRace.entries.map((e) => {
              const isSpeed = ["E", "EP"].includes(e.style);
              const isCloser = ["S", "C"].includes(e.style);
              const benefit = pace.earlyCount >= 3
                ? (isCloser ? "positive" : isSpeed ? "negative" : "neutral")
                : (pace.earlyCount === 1 && isSpeed ? "positive" : "neutral");

              const benefitIcon = benefit === "positive" ? "+" : benefit === "negative" ? "-" : "=";
              const benefitColor = benefit === "positive" ? "text-emerald-400" : benefit === "negative" ? "text-red-400" : "text-zinc-400";

              let analysis = "";
              if (isSpeed && pace.earlyCount >= 3) analysis = "Speed duel scenario. Likely to tire from contested pace.";
              else if (isSpeed && pace.earlyCount === 1) analysis = "Lone speed. Can control pace unchallenged.";
              else if (isSpeed && pace.earlyCount === 2) analysis = "Contested pace. Will duel with one other.";
              else if (isCloser && pace.earlyCount >= 3) analysis = "Speed collapse likely. Prime closer scenario.";
              else if (isCloser && pace.earlyCount <= 1) analysis = "Soft pace. May not get needed pace setup.";
              else analysis = "Tactical position. Can adjust to pace flow.";

              return (
                <tr key={e.pp} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-3 px-3 font-mono text-zinc-400">{e.pp}</td>
                  <td className="py-3 px-3 font-semibold">{e.name}</td>
                  <td className="py-3 px-3 text-center"><Badge style={e.style} /></td>
                  <td className="py-3 px-3 text-center font-mono">{e.e1Pace}</td>
                  <td className="py-3 px-3 text-center font-mono">{e.latePace}</td>
                  <td className={`py-3 px-3 text-center text-lg font-bold ${benefitColor}`}>{benefitIcon}</td>
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

function About() {
  return (
    <div className="max-w-3xl space-y-6 text-zinc-300">
      <h3 className="text-lg font-semibold text-zinc-100">Architecture</h3>
      <p>
        <strong className="text-zinc-100">Benter Conditional Logit</strong> with public odds as a fixed offset (coefficient = 1.0). Uses statsmodels GLM with proper offset parameter so the log-likelihood is correct during training. Softmax normalization for discrete choice.
      </p>
      <p>
        <strong className="text-zinc-100">LightGBM</strong> gradient boosting with native NaN handling, early stopping, L1/L2 regularization, and class imbalance handling. Tuned for noisy racing data (~70 features).
      </p>
      <p>
        <strong className="text-zinc-100">Ensemble</strong> combines models in log-odds space (logarithmic opinion pool) to preserve longshot overlay signals that linear probability averaging would compress.
      </p>
      <p>
        <strong className="text-zinc-100">Monte Carlo</strong> uses the Henery normal model with probit transform (not logit) for exotic bet pricing. 100K simulations produce full finish-order distributions.
      </p>

      <h3 className="text-lg font-semibold text-zinc-100 pt-4">Key Features (70+)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {[
          "Speed: best/avg/last Beyer, trend slope, stdev",
          "Pace: E1/E2/late, velocity change, early-late ratio",
          "Pace Scenario: lone speed, speed duel, hot/soft pace",
          "Pace Interactions: style x scenario crossings",
          "Class: purse change, claiming ratio, race type ladder",
          "Form: non-linear rest buckets, log days since last",
          "Jockey/Trainer: win%, ROI, starts (date-filtered)",
          "Post Position: surface/distance interactions",
          "Trip Shape: position gains, late kick, troubled trips",
          "Equipment: first-time blinkers, blinkers off, Lasix",
          "Distance/Surface: experience %, switch, route-to-sprint",
          "Odds: morning line, implied prob, log odds, favorite",
        ].map((f) => (
          <div key={f} className="p-2 rounded bg-zinc-900 border border-zinc-800">{f}</div>
        ))}
      </div>

      <h3 className="text-lg font-semibold text-zinc-100 pt-4">Evolution Highlights</h3>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li>Fixed backtesting to predict per-race (was normalizing across all races)</li>
        <li>Eliminated jockey/trainer lookahead bias with date filtering</li>
        <li>Proper GLM offset for Benter model (was regularizing away the baseline)</li>
        <li>Probit transform in Henery model (logit has wrong tail behavior)</li>
        <li>Track takeout (17%) in Kelly/EV calculations</li>
        <li>Log-odds ensemble averaging preserves longshot signals</li>
      </ul>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("card");

  const tabs: { id: Tab; label: string }[] = [
    { id: "card", label: "Race Card" },
    { id: "predictions", label: "Predictions" },
    { id: "pace", label: "Pace Analysis" },
    { id: "about", label: "About" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">HorseGPT v3.14</h1>
            <p className="text-sm text-zinc-400">Multi-model horse racing handicapping tool</p>
          </div>
          <div className="text-right text-sm text-zinc-500">
            <div>SAR R5 &middot; Aug 15, 2023</div>
            <div>ALW &middot; 6f Dirt &middot; Fast</div>
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
        {tab === "card" && <RaceCard />}
        {tab === "predictions" && <Predictions />}
        {tab === "pace" && <PaceAnalysis />}
        {tab === "about" && <About />}
      </main>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-500">
        HorseGPT v3.14 &middot; Benter Odds-Offset + LightGBM Ensemble &middot; Henery Monte Carlo (Probit)
      </footer>
    </div>
  );
}
