import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

interface PlanInput {
  artists: string[];
  domains: Record<string, string[]>;
}

function buildFallback(artists: string[], d: Record<string, string[]>) {
  const city = d["Travel"]?.[0] ?? "Los Angeles";
  const hood = d["Travel"]?.[1] ?? "Brooklyn";
  const spots = d["Restaurants & Places"] ?? ["Roscoe's Chicken & Waffles", "Flora Rooftop Bar and Lounge", "The Belasco"];
  const films = d["Movies"] ?? ["Mid90s", "Blindspotting"];
  const shows = d["TV Shows"] ?? ["Atlanta", "Insecure"];
  const brands = d["Brands"] ?? ["Nike", "Supreme"];
  const books = d["Books"] ?? ["The Jordan Rules"];
  const games = d["Video Games"] ?? ["Apex Legends"];

  return [
    `CITY: ${city} (with a detour through ${hood})`,
    `TASTE SEEDS: ${artists.slice(0, 6).join(" · ")}`,
    ``,
    `SATURDAY`,
    `• Morning — Coffee & fit check in ${ brands.slice(0, 2).join(" + ") }, reading "${books[0]}".`,
    `• Afternoon — Explore ${city}; lunch at ${spots[0] ?? "a local spot"}.`,
    `• Night — Dinner & drinks at ${spots[1] ?? spots[0]}, followed by a late screening of ${films[0]}.`,
    ``,
    `SUNDAY`,
    `• Brunch — ${spots[2] ?? spots[0]} in ${hood}.`,
    `• Evening — Binge ${shows.slice(0, 2).join(" & ")}, double-feature with ${films[1] ?? films[0]}, and run a few rounds of ${games[0]}.`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const { artists = [], domains = {} } = (await req.json()) as PlanInput;
  const fallback = buildFallback(artists, domains);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ plan: fallback, source: "qloo-template" });
  }

  try {
    const summary = Object.entries(domains)
      .map(([k, v]) => `${k}: ${v.slice(0, 4).join(", ")}`)
      .join("\n");
    const { text } = await generateText({
      model: anthropic("claude-3-5-haiku-latest"),
      maxOutputTokens: 320,
      prompt: `You are Vybe, a cultural concierge powered by Qloo Taste AI.
User's taste seeds: ${artists.join(", ")}
Qloo cross-domain matches:
${summary}

Write a punchy, stylish 48-hour weekend plan (Saturday & Sunday, 3 bullets each) set in the top Travel match that weaves in the matched Restaurants & Places, Movies, TV Shows, Brands, Books, and Video Games by exact name. Plain text only, no markdown headers (#), keep it under 140 words.`,
    });
    return NextResponse.json({ plan: text.trim() || fallback, source: "ai" });
  } catch {
    return NextResponse.json({ plan: fallback, source: "qloo-template" });
  }
}
