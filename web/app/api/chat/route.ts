import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { CD_2026_05_02 } from "../../lib/cd-2026-05-02";
import picks from "../../lib/cd-2026-05-02-picks.json";

// Use existing GEMINI_API_KEY env (also fall back to GOOGLE_GENERATIVE_AI_API_KEY).
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const maxDuration = 60;

// Build today's card summary inline so HorseGPT has context without extra fetches.
const cardSummary = CD_2026_05_02.map((r) => {
  const horses = r.horses
    .map((h) => `#${h.program} ${h.name} (ML ${h.mlOdds}, style ${h.style})`)
    .join("; ");
  return `R${r.raceNumber} ${r.postTime} ${r.distance} ${r.surface} (${r.raceType}, $${r.purse?.toLocaleString?.() ?? r.purse}): ${horses}`;
}).join("\n");

const picksSummary = (picks.races as Array<{ raceNumber: number; edgeTier: string; algoTop2: string; mktTop2: string; play: string; ticket: string; cost: number; horses: Array<{ rank: number; program: string; name: string; mlOdds: number | null; scorePct: number }> }>)
  .map((r) => {
    const top3 = r.horses.slice(0, 3).map((h) => `${h.rank}. #${h.program} ${h.name} (${h.scorePct.toFixed(1)}%)`).join(", ");
    return `R${r.raceNumber} [${r.edgeTier}]: algo top-2 ${r.algoTop2}, mkt ${r.mktTop2}. Top-3: ${top3}. Play: ${r.play}${r.ticket ? ` (${r.ticket} $${r.cost})` : ""}`;
  })
  .join("\n");

const SYSTEM_PROMPT = `You are HorseGPT — the in-house assistant for the HorseGPT v3.14 Churchill Downs platform.
Your job is to answer questions about today's card (Kentucky Derby Day 2026-05-02), the algorithm, and the picks.
Be direct and honest — Jason wants real answers, not sugar.

PERSONALITY:
- Direct, technical, confident. No fluff. No emojis.
- If you're uncertain, say so. If you don't have data, say so. Never invent numbers.
- Defend the algo on the merits OR concede legit critique.

TODAY'S CARD (Churchill Downs, Saturday May 02, 2026 — Derby 152):
${cardSummary}

PICKS + EDGE TIERS (strict mode):
${picksSummary}

HOW THE ALGO WORKS (post-hardening):

1. **Benter market anchor.** ML odds → implied prob → normalize across field. Algo only models the *residual* where market is wrong.
2. **CD track-bias multiplier.** Per (surface, distance), post IV + style IV. Multiply market prob (clamped 0.5–1.6).
3. **Trainer/jockey tier bonus.** Top CD operators get +0.03–0.07.
4. **BRIS-rich ability factor.** z-score of (Prime Power + best last-3 Beyer) within field → multiplier 0.7–1.4.
5. **Final score** = market_prob × bias × tier × ability → renormalize → rank.

CHALK-OVERLAP RULE (the load-bearing fix):
- "FULL EDGE" = algo top-2 has 0 horses in market top-2 → bettable
- "PARTIAL EDGE" = algo top-2 has 1 horse in market top-2 → bettable, forward exacta or wheel
- "CHALK MATCH" = algo top-2 = market top-2 → PASS in strict mode (paying 22% takeout for a market box is negative-EV)
- DeepSeek + Kimi adversarial reviews + 18-race stratified audit confirmed: in CHALK MATCH races, the algo had ZERO ordering edge over the market.

EXOTIC v2 (Henery-corrected ordering, NEW):
- Standard Harville formula systematically overstates favorites in 2nd/3rd. Use Lo & Bacon-Shone approximation:
  σ_i (2nd) = exp(γ · log p_i) / Σ exp(γ · log p_j),  γ = 0.81
  τ_i (3rd) = exp(δ · log p_i) / Σ exp(δ · log p_j),  δ = 0.65
- Edge is multiplicative across positions — small EV per leg compounds in trifecta/super.
- Recipe: KEY a 10%+-overlay horse on top, WHEEL 3-4 underneath. Box only the no-favorite races.

DERBY (R12) IS ANOMALOUS: 20-horse field, once-a-year, many horses running 1.25M for the first time. Model trained on smaller fields. Treat output as suggestive — skew to wider super coverage, smaller per-combo cost.

DON'T:
- Make up odds, finishes, or horses not in the card summary.
- Tell Jason what to bet. Explain the algo's view; the bet is his call.
- Use emojis or marketing language.

Today's date is 2026-05-02. Derby R12 post 6:57 PM ET.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
