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
  "urn:entity:video_game",
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
  const [insights, setInsights] = useState<InsightGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "artists" | "results">("idle");
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
        const { insights: ci, artists: ca } = JSON.parse(cached);
        setInsights(ci);
        setArtists(ca);
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
      "B5B9A7E4-3A1B-4E5C-9F6D-2A8C7E1B4D5F", // Tyler The Creator
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
    setPhase("results");

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ insights: data, artists: demoArtists }));
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
    setPhase("results");

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ insights: data, artists: spotifyArtists }));
    } catch {}

    setLoading(false);
  }

  function reset() {
    setInsights([]);
    setArtists([]);
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
            padding: "18px 32px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(12px)",
            zIndex: 10,
          }}>
            <span style={{
              fontFamily: "var(--font-bebas), sans-serif",
              fontSize: 26,
              display: "flex", alignItems: "center", gap: 8,
              letterSpacing: "0.05em",
            }}>
              <VybeLogo size={28} />VYBE
              <span style={{
                marginLeft: 8,
                fontSize: 11,
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-accent)",
                verticalAlign: "middle",
              }}>Taste AI</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 13, color: "var(--color-muted-foreground)" }}>
                {artists.length} top artists mapped
              </span>
              <button
                onClick={reset}
                style={{
                  padding: "6px 14px",
                  background: "transparent",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  color: "var(--color-muted-foreground)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "inherit",
                  transition: "border-color 150ms, color 150ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                  e.currentTarget.style.color = "var(--color-foreground)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.color = "var(--color-muted-foreground)";
                }}
              >
                Reconnect
              </button>
            </div>
          </header>

          {/* Artists strip */}
          {artists.length > 0 && (
            <div style={{ padding: "24px 32px 0" }}>
              <p style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-muted-foreground)",
                marginBottom: 12,
              }}>Your taste seeds</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {artists.map((a) => (
                  <span key={a.id} style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px 5px 5px",
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 500,
                  }}>
                    {a.images?.[2]?.url && (
                      <img src={a.images[2].url} alt={a.name} width={20} height={20}
                        style={{ borderRadius: "50%", objectFit: "cover" }} />
                    )}
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Insight groups */}
          <div style={{ padding: "32px 32px 80px" }}>
            {insights.map((group) => (
              <div key={group.type} style={{ marginBottom: 48 }}>
                <h2 style={{
                  fontFamily: "var(--font-bebas), sans-serif",
                  fontSize: 22,
                  fontWeight: 400,
                  letterSpacing: "0.08em",
                  color: "var(--color-accent)",
                  marginBottom: 16,
                }}>
                  {group.domain}
                </h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 16,
                }}>
                  {group.entities.slice(0, 8).map((e) => (
                    <div
                      key={e.entity_id}
                      style={{
                        background: "var(--color-card)",
                        border: "2px solid var(--color-border)",
                        borderRadius: 12,
                        padding: 20,
                        transition: "border-color 200ms, transform 150ms, box-shadow 200ms",
                      }}
                      onMouseEnter={(el) => {
                        el.currentTarget.style.borderColor = "var(--color-accent)";
                        el.currentTarget.style.transform = "translateY(-3px)";
                        el.currentTarget.style.boxShadow = "0 8px 24px rgba(225,29,72,0.12)";
                      }}
                      onMouseLeave={(el) => {
                        el.currentTarget.style.borderColor = "var(--color-border)";
                        el.currentTarget.style.transform = "translateY(0)";
                        el.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <p style={{ fontWeight: 600, margin: "0 0 6px", fontSize: 15 }}>{e.name}</p>
                      {e.properties?.description && (
                        <p style={{
                          fontSize: 13,
                          color: "var(--color-muted-foreground)",
                          margin: 0,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}>
                          {e.properties.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

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
