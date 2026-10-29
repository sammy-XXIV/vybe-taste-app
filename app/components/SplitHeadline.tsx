"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const GLITCH_CHARS = "!<>-_\\/[]{}—=+*^?#@$%&";

function randomChar() {
  return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
}

interface Props {
  lines: { text: string; accent?: boolean; effect: "wave" | "glitch" | "reveal" }[];
  style?: React.CSSProperties;
}

export default function SplitHeadline({ lines, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const tl = gsap.timeline({ delay: 0.1 });

    lines.forEach((line, li) => {
      const lineEl = containerRef.current!.querySelectorAll<HTMLDivElement>(".vybe-line")[li];
      const letters = lineEl.querySelectorAll<HTMLSpanElement>(".vybe-letter");

      if (line.effect === "wave") {
        // Soundwave: letters ripple in by sine-based stagger
        tl.fromTo(
          letters,
          { opacity: 0, y: 60, scaleY: 0.2 },
          {
            opacity: 1, y: 0, scaleY: 1,
            duration: 0.5,
            ease: "back.out(2)",
            stagger: { each: 0.04, from: "start" },
          },
          li * 0.3
        );
      }

      if (line.effect === "glitch") {
        tl.set(letters, { opacity: 1 }, li * 0.3);

        // Store real chars up front
        const realChars: string[] = [];
        letters.forEach((el, i) => { realChars[i] = el.textContent ?? ""; });

        let done = false;

        tl.to(
          {},
          {
            duration: 0.55,
            onStart() {
              letters.forEach((el) => {
                el.style.color = "var(--color-accent)";
              });
            },
            onUpdate() {
              if (done) return;
              letters.forEach((el) => {
                if (Math.random() > 0.35) {
                  el.textContent = randomChar();
                  el.style.color = Math.random() > 0.5 ? "#E11D48" : "#6366F1";
                }
              });
            },
            onComplete() {
              done = true;
              letters.forEach((el, i) => {
                el.textContent = realChars[i];
                el.style.color = "var(--color-accent)";
              });
            },
          },
          li * 0.3
        );

        tl.fromTo(
          letters,
          { skewX: 6 },
          { skewX: 0, duration: 0.25, ease: "power3.out", stagger: 0.02 },
          ">"
        );
      }

      if (line.effect === "reveal") {
        // Clip mask slide up
        lineEl.style.overflow = "hidden";
        tl.fromTo(
          letters,
          { y: "110%", opacity: 0 },
          {
            y: "0%", opacity: 1,
            duration: 0.6,
            ease: "expo.out",
            stagger: { each: 0.03, from: "start" },
          },
          li * 0.3
        );
      }
    });
  }, []);

  return (
    <div ref={containerRef} style={style}>
      {lines.map((line, li) => (
        <div key={li} className="vybe-line" style={{ display: "block", overflow: "visible" }}>
          {line.text.split("").map((char, ci) => (
            <span
              key={ci}
              className="vybe-letter"
              style={{
                display: "inline-block",
                color: line.accent ? "var(--color-accent)" : "var(--color-foreground)",
                whiteSpace: char === " " ? "pre" : "normal",
              }}
            >
              {char === " " ? " " : char}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
