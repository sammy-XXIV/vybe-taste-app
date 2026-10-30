"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { EntityType, QlooEntity } from "@/lib/qloo";
import gsap from "gsap";
import SplitHeadline from "./components/SplitHeadline";
import VybeLogo from "./components/VybeLogo";

const OUTPUT_TYPES: EntityType[] = [
  "urn:entity:place",
  "urn:entity:destination",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:brand",
  "urn:entity:book",
  "urn:entity:videogame",
];

interface InsightGroup {
  domain: string;
  type: string;
  entities: QlooEntity[];
}

interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
}

const STORAGE_KEY = "vybe_insights_cache";

export default function Home() {
  const { data: session, status } = useSession();
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [seedIds, setSeedIds] = useState<string[]>([]);
  const [insights, setInsights] = useState<InsightGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planText, setPlanText] = useState<string>("");
  const [planLoading, setPlanLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "artists" | "results">("idle");
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  const heroRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "idle") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      // Orb float animations
      if (orb1Ref.current) gsap.to(orb1Ref.current, { y: -30, x: 20, duration: 6, repeat: -1, yoyo: true, ease: "sine.inOut" });
      if (orb2Ref.current) gsap.to(orb2Ref.current, { y: 40, x: -25, duration: 8, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1 });
      if (orb3Ref.current) gsap.to(orb3Ref.current, { y: -20, x: 30, duration: 5, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 2 });

      // Entrance stagger
      const els = [subRef.current, btnRef.current, badgeRef.current].filter(Boolean);
      gsap.from(els, {
        opacity: 0,
        y: 40,
        duration: 0.8,
        stagger: 0.15,
        ease: "back.out(1.4)",
        delay: 0.2,
      });
    }, heroRef);

    return () => ctx.revert();
  }, [phase]);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { insights: ci, artists: ca, seedIds: cs } = JSON.parse(cached);
        setInsights(ci);
        setArtists(ca);
        if (cs) setSeedIds(cs);
        setPhase("results");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (session && phase === "idle") fetchAndDiscover();
  }, [session]);

  useEffect(() => {
    setMounted(true);
    if (new URLSearchParams(window.location.search).get("demo") === "1" && phase === "idle") {
      fetchDemoDiscover();
    }
  }, []);

  async function fetchDemoDiscover() {
    const demoArtists: SpotifyArtist[] = [
      { id: "1", name: "Kendrick Lamar", images: [], genres: ["hip hop"] },
      { id: "2", name: "Frank Ocean", images: [], genres: ["r&b"] },
      { id: "3", name: "Tyler The Creator", images: [], genres: ["hip hop"] },
      { id: "4", name: "SZA", images: [], genres: ["r&b"] },
      { id: "5", name: "Travis Scott", images: [], genres: ["trap"] },
    ];
    setLoading(true);
    setPhase("artists");
    setArtists(demoArtists);

    // Hardcoded fallback IDs so demo works even if search fails
    const FALLBACK_IDS = [
      "C915A918-39C5-47A3-A101-D9FA1DECBD9C", // Kendrick Lamar
      "8CA2E4E6-D8AB-4A73-97C9-3FCC8F9BB3E8", // Frank Ocean
      "375758AA-B0FA-4508-8EC1-D7FBFE3A4B3C", // Tyler, the Creator
    ];
    const entityIds: string[] = [...FALLBACK_IDS];
    try {
      await Promise.all(
        demoArtists.map(async (a) => {
          const res = await fetch(`/api/search?q=${encodeURIComponent(a.name)}&type=urn:entity:artist`);
          const results = await res.json();
          if (results[0]?.entity_id && !entityIds.includes(results[0].entity_id)) {
            entityIds.push(results[0].entity_id);
          }
        })
      );
    } catch {}

    if (!entityIds.length) { setLoading(false); setPhase("idle"); return; }

    const insightsRes = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityIds, outputTypes: OUTPUT_TYPES }),
    });
    const data: InsightGroup[] = await insightsRes.json();
    setInsights(data);
    setSeedIds(entityIds);
    setPhase("results");

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ insights: data, artists: demoArtists, seedIds: entityIds }));
    } catch {}
    setLoading(false);
  }

  async function fetchAndDiscover() {
    setLoading(true);
    setPhase("artists");

    const artistsRes = await fetch("/api/spotify/top-artists");
    if (!artistsRes.ok) { setLoading(false); setPhase("idle"); return; }
    const spotifyArtists: SpotifyArtist[] = await artistsRes.json();
    setArtists(spotifyArtists);

    const entityIds: string[] = [];
    await Promise.all(
      spotifyArtists.slice(0, 5).map(async (a) => {
        const res = await fetch(`/api/search?q=${encodeURIComponent(a.name)}&type=artist`);
        const results = await res.json();
        if (results[0]?.entity_id) entityIds.push(results[0].entity_id);
      })
    );

    if (!entityIds.length) { setLoading(false); setPhase("idle"); return; }

    const insightsRes = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityIds, outputTypes: OUTPUT_TYPES }),
    });
    const data: InsightGroup[] = await insightsRes.json();
    setInsights(data);
    setSeedIds(entityIds);
    setPhase("results");

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ insights: data, artists: spotifyArtists, seedIds: entityIds }));
    } catch {}

    setLoading(false);
  }

  async function refineWithEntity(entity: QlooEntity) {
    if (seedIds.includes(entity.entity_id) || refiningId) return;
    setRefiningId(entity.entity_id);
    const nextIds = [...seedIds, entity.entity_id];
    const nextArtists: SpotifyArtist[] = [
      ...artists,
      { id: entity.entity_id, name: entity.name, images: [], genres: [] },
    ];
    setSeedIds(nextIds);
    setArtists(nextArtists);
    setPlanText("");
    try {
      const insightsRes = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityIds: nextIds, outputTypes: OUTPUT_TYPES }),
      });
      const data: InsightGroup[] = await insightsRes.json();
      if (data.length) {
        setInsights(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ insights: data, artists: nextArtists, seedIds: nextIds }));
      }
    } catch {}
    setRefiningId(null);
  }

  async function openWeekendPlan() {
    setPlanOpen(true);
    if (planText || planLoading) return;
    setPlanLoading(true);
    try {
      const domains: Record<string, string[]> = {};
      insights.forEach((g) => {
        domains[g.domain] = g.entities.slice(0, 4).map((e) => e.name);
      });
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artists: artists.map((a) => a.name), domains }),
      });
      const data = await res.json();
      setPlanText(data.plan || "");
    } catch {
      setPlanText("Could not generate plan right now.");
    }
    setPlanLoading(false);
  }

  function reset() {
    setInsights([]);
    setArtists([]);
    setSeedIds([]);
    setPlanText("");
    setPlanOpen(false);
    setPhase("idle");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    signOut({ redirect: false });
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-background)" }}>

      {/* ─── LANDING ─── */}
      {phase === "idle" && mounted && status !== "loading" && (
        <section
          ref={heroRef}
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Floating orbs */}
          <div ref={orb1Ref} style={{
            position: "absolute", top: "15%", left: "10%",
            width: 340, height: 340,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(225,29,72,0.18) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }} />
          <div ref={orb2Ref} style={{
            position: "absolute", bottom: "20%", right: "8%",
            width: 280, height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }} />
          <div ref={orb3Ref} style={{
            position: "absolute", top: "55%", left: "20%",
            width: 200, height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(225,29,72,0.1) 0%, transparent 70%)",
            filter: "blur(30px)",
            pointerEvents: "none",
          }} />

          {/* Content */}
          <SplitHeadline
            lines={[
              { text: "YOUR TASTE", effect: "wave" },
              { text: "PREDICTS", accent: true, effect: "glitch" },
              { text: "EVERYTHING", effect: "reveal" },
            ]}
            style={{
              fontFamily: "var(--font-bebas), sans-serif",
              fontSize: "clamp(4rem, 12vw, 9rem)",
              lineHeight: 0.95,
              letterSpacing: "0.02em",
              margin: "0 0 24px",
              position: "relative",
              zIndex: 1,
              textAlign: "center",
            }}
          />

          <p
            ref={subRef}
            style={{
              color: "var(--color-muted-foreground)",
              fontSize: "clamp(15px, 2vw, 18px)",
              maxWidth: 480,
              margin: "0 0 44px",
              lineHeight: 1.65,
              position: "relative",
              zIndex: 1,
            }}
          >
            Connect Spotify. Vybe reads your top artists and maps your cultural DNA
            across dining, travel, film, brands — connections no single platform can make.
          </p>

          <button
            ref={btnRef}
            onClick={() => signIn("spotify")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 36px",
              background: "#1DB954",
              color: "#000",
              border: "none",
              borderRadius: 50,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "transform 150ms, box-shadow 150ms",
              position: "relative",
              zIndex: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 0 32px rgba(29,185,84,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <SpotifyIcon />
            Connect Spotify
          </button>

          <a
            href="/?demo=1"
            style={{
              marginTop: 16,
              color: "var(--color-muted-foreground)",
              fontSize: 13,
              textDecoration: "underline",
              textUnderlineOffset: 3,
              position: "relative",
              zIndex: 1,
            }}
          >
            Try demo without Spotify
          </a>

          <div
            ref={badgeRef}
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--color-muted-foreground)",
              fontSize: 13,
              position: "relative",
              zIndex: 1,
              flexWrap: "wrap",
              justifyContent: "center",
              whiteSpace: "nowrap",
            }}
          >
            <span>Powered by <span style={{ color: "var(--color-foreground)", fontWeight: 600 }}>Qloo Taste AI</span></span>
            <span style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "var(--color-muted-foreground)",
              display: "inline-block",
            }} />
            <span>Read-only · No data stored</span>
          </div>
        </section>
      )}

      {/* ─── LOADING ─── */}
      {(loading || !mounted || phase === "artists") && phase !== "results" && (
        <section style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 24,
          textAlign: "center",
        }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: "50%",
            border: "3px solid var(--color-border)",
            borderTopColor: "var(--color-accent)",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: "var(--color-muted-foreground)", fontSize: 16 }}>
            {phase === "artists" ? "Reading your Spotify taste…" : "Mapping across all domains…"}
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </section>
      )}

      {/* ─── RESULTS ─── */}
      {phase === "results" && !loading && (
        <>
          <header style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "rgba(0,0,0,0.9)",
            backdropFilter: "blur(16px)",
            zIndex: 10,
          }}>
            <span style={{
              fontFamily: "var(--font-bebas), sans-serif",
              fontSize: 24,
              display: "flex", alignItems: "center", gap: 6,
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}>
              <VybeLogo size={24} />VYBE
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={openWeekendPlan}
                style={{
                  padding: "6px 14px",
                  background: "var(--color-accent)",
                  border: "none",
                  borderRadius: 20,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                ✦ Plan Weekend
              </button>
              <button
                onClick={reset}
                style={{
                  padding: "6px 14px",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: 20,
                  color: "var(--color-muted-foreground)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                ↩ Reset
              </button>
            </div>
          </header>

          {/* Tab bar */}
          <div style={{
            display: "flex",
            overflowX: "auto",
            scrollbarWidth: "none",
            borderBottom: "1px solid var(--color-border)",
            background: "#000",
            position: "sticky",
            top: 53,
            zIndex: 9,
          }}>
            {insights.map((group, i) => (
              <button
                key={group.type}
                onClick={() => setActiveTab(i)}
                style={{
                  flexShrink: 0,
                  padding: "12px 18px",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === i ? "2px solid var(--color-accent)" : "2px solid transparent",
                  color: activeTab === i ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: activeTab === i ? 600 : 400,
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  transition: "color 150ms",
                }}
              >
                {group.domain}
              </button>
            ))}
          </div>

          {/* Active tab content */}
          {insights[activeTab] && (
            <div style={{ padding: "20px 16px 100px" }}>
              {/* Taste seeds */}
              {artists.length > 0 && (
                <div style={{
                  display: "flex",
                  gap: 6,
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  marginBottom: 20,
                }}>
                  {artists.map((a) => (
                    <span key={a.id} style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 9px 3px 3px",
                      background: "#111",
                      border: "none",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      color: "var(--color-muted-foreground)",
                    }}>
                      {a.images?.[2]?.url && (
                        <img src={a.images[2].url} alt={a.name} width={16} height={16}
                          style={{ borderRadius: "50%", objectFit: "cover" }} />
                      )}
                      {a.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Cards grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}>
                {insights[activeTab].entities.slice(0, 8).map((e) => {
                  const inTaste = seedIds.includes(e.entity_id);
                  const isRefining = refiningId === e.entity_id;
                  return (
                    <div
                      key={e.entity_id}
                      style={{
                        background: "#111",
                        border: "none",
                        borderRadius: 14,
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div>
                        <p style={{
                          fontWeight: 600,
                          margin: "0 0 5px",
                          fontSize: 13,
                          lineHeight: 1.3,
                        }}>{e.name}</p>
                        {e.properties?.description && (
                          <p style={{
                            fontSize: 11,
                            color: "var(--color-muted-foreground)",
                            margin: 0,
                            lineHeight: 1.45,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}>
                            {e.properties.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => refineWithEntity(e)}
                        disabled={inTaste || !!refiningId}
                        style={{
                          alignSelf: "flex-start",
                          padding: "4px 10px",
                          background: inTaste ? "rgba(225,29,72,0.16)" : "#1a1a1a",
                          border: "none",
                          borderRadius: 12,
                          color: inTaste ? "var(--color-accent)" : "var(--color-muted-foreground)",
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          cursor: inTaste ? "default" : "pointer",
                        }}
                      >
                        {isRefining ? "Refining…" : inTaste ? "✓ In taste" : "+ Add to taste"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {planOpen && (
            <div
              onClick={() => setPlanOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.82)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                zIndex: 50,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 460,
                  background: "#0d0d0d",
                  border: "2px solid var(--color-accent)",
                  borderRadius: 18,
                  padding: 22,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontFamily: "var(--font-bebas), sans-serif", fontSize: 26, letterSpacing: "0.04em" }}>
                    ✦ YOUR 48-HOUR CULTURAL PLAN
                  </span>
                  <button
                    onClick={() => setPlanOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--color-muted-foreground)",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
                {planLoading ? (
                  <p style={{ color: "var(--color-muted-foreground)", fontSize: 13, padding: "20px 0" }}>
                    Building your weekend across Qloo domains…
                  </p>
                ) : (
                  <pre style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "var(--color-foreground)",
                    margin: 0,
                  }}>
                    {planText}
                  </pre>
                )}
              </div>
            </div>
          )}

          <footer style={{
            textAlign: "center",
            padding: "20px",
            color: "var(--color-muted-foreground)",
            fontSize: 13,
            borderTop: "1px solid var(--color-border)",
          }}>
            Powered by <a href="https://qloo.com" style={{ color: "var(--color-accent)", textDecoration: "none" }}>Qloo Taste AI</a> · Qloo Agentic Hackathon 2026
          </footer>
        </>
      )}
    </main>
  );
}

function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}
