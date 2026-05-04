// Churchill Downs — Wednesday, April 29, 2026
// Card preview only. Brisnet PPs pending — no picks until ingestion completes.

interface RaceShell {
  raceNumber: number;
  postTime: string;
  raceType: string;
  distance: string;
  surface: "Dirt" | "Turf";
  purse: number;
  fieldSize: number;
  isStakes?: boolean;
  stakesName?: string;
}

const CARD_DATE = "Wednesday, April 29, 2026";
const CARD: RaceShell[] = [
  { raceNumber: 1,  postTime: "12:45 PM", raceType: "Claiming",                distance: "1m",         surface: "Dirt", purse: 55000,  fieldSize: 8 },
  { raceNumber: 2,  postTime: "1:15 PM",  raceType: "Claiming",                distance: "6.5f",       surface: "Dirt", purse: 64000,  fieldSize: 7 },
  { raceNumber: 3,  postTime: "1:45 PM",  raceType: "MSW",                     distance: "4.5f",       surface: "Dirt", purse: 120000, fieldSize: 12 },
  { raceNumber: 4,  postTime: "2:16 PM",  raceType: "Maiden Claiming",         distance: "1 1/16m",    surface: "Turf", purse: 67000,  fieldSize: 15 },
  { raceNumber: 5,  postTime: "2:47 PM",  raceType: "Maiden Claiming",         distance: "6f",         surface: "Dirt", purse: 67000,  fieldSize: 10 },
  { raceNumber: 6,  postTime: "3:20 PM",  raceType: "Stakes",                  distance: "5f",         surface: "Dirt", purse: 250000, fieldSize: 8,  isStakes: true, stakesName: "Kentucky Juvenile" },
  { raceNumber: 7,  postTime: "3:52 PM",  raceType: "Allowance Optional Claim", distance: "5f",         surface: "Turf", purse: 134000, fieldSize: 13 },
  { raceNumber: 8,  postTime: "4:25 PM",  raceType: "Starter Allowance",       distance: "7f",         surface: "Dirt", purse: 83000,  fieldSize: 10 },
  { raceNumber: 9,  postTime: "4:56 PM",  raceType: "Stakes",                  distance: "1 1/2m",     surface: "Dirt", purse: 200000, fieldSize: 9,  isStakes: true, stakesName: "Isaac Murphy Marathon" },
  { raceNumber: 10, postTime: "5:27 PM",  raceType: "Claiming",                distance: "1 1/16m",    surface: "Turf", purse: 62000,  fieldSize: 16 },
];

const totalPurse = CARD.reduce((s, r) => s + r.purse, 0);
const stakesPurse = CARD.filter(r => r.isStakes).reduce((s, r) => s + r.purse, 0);

export default function CDTodayPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gradient-to-b from-emerald-950/40 to-black px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                Churchill Downs
              </h1>
              <p className="text-emerald-300 text-sm md:text-base mt-1 font-medium">
                {CARD_DATE} · Spring Meet · Day 4
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-gray-500">Total Purse</p>
              <p className="text-2xl font-black text-white">${totalPurse.toLocaleString()}</p>
              <p className="text-xs text-emerald-400">{CARD.length} races · ${stakesPurse.toLocaleString()} stakes</p>
            </div>
          </div>
        </div>
      </header>

      {/* PPs pending banner */}
      <div className="border-b border-amber-900/40 bg-amber-950/30 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <span className="text-amber-400 text-lg">⚠</span>
          <div>
            <p className="text-amber-200 text-sm font-bold">Brisnet PPs pending</p>
            <p className="text-amber-300/70 text-xs">Card preview only. Picks, EV tickets, and exotics will populate when past performances are ingested. Check back before first post.</p>
          </div>
        </div>
      </div>

      {/* Race grid */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {CARD.map((r) => (
          <RaceShellCard key={r.raceNumber} race={r} />
        ))}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-900 px-4 py-6 text-center text-xs text-gray-600">
        HorseGPT v3.14 · Stage 1 ability + Stage 2 market exit · awaiting today&apos;s data
      </footer>
    </main>
  );
}

function RaceShellCard({ race }: { race: RaceShell }) {
  const stakesAccent = race.isStakes ? "border-emerald-600 bg-emerald-950/30" : "border-gray-800 bg-[#0a0a0a]";

  return (
    <section className={`rounded-xl border-2 ${stakesAccent} overflow-hidden`}>
      <div className="px-4 py-3 flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl md:text-3xl font-black text-white">R{race.raceNumber}</span>
          <span className="text-sm md:text-base text-gray-300 font-mono">{race.postTime}</span>
        </div>
        {race.isStakes && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-black text-xs font-black uppercase tracking-wider">
            Stakes
          </span>
        )}
      </div>
      <div className="px-4 pb-3 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          {race.stakesName && (
            <p className="text-emerald-300 font-bold text-sm md:text-base">{race.stakesName}</p>
          )}
          <p className="text-gray-200 text-sm">
            <span className="font-semibold">{race.distance}</span>
            <span className="text-gray-500"> · </span>
            <span className={race.surface === "Turf" ? "text-emerald-400" : "text-amber-300"}>{race.surface}</span>
            <span className="text-gray-500"> · </span>
            <span>{race.raceType}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-black text-white">${race.purse.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{race.fieldSize} entries</p>
        </div>
      </div>
    </section>
  );
}
