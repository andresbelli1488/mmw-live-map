"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventRecord, PulseItem } from "@/lib/types";

type DayKey = "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type Props = {
  initialEvents: EventRecord[];
};

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const BG = "#09090b";
const CARD = "#111114";
const BORDER = "rgba(255,255,255,0.12)";
const TXT = "#f4f4f5";
const MUTED = "#a1a1aa";
const ACCENT = "#d8b86b";

function dayKeyFromEvent(event: EventRecord): DayKey {
  if (["tue", "wed", "thu", "fri", "sat", "sun"].includes(event.day.toLowerCase())) {
    return event.day.toLowerCase() as DayKey;
  }

  const d = new Date(event.startAt);
  const wd = d.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  if (wd.startsWith("tue")) return "tue";
  if (wd.startsWith("wed")) return "wed";
  if (wd.startsWith("thu")) return "thu";
  if (wd.startsWith("fri")) return "fri";
  if (wd.startsWith("sat")) return "sat";
  return "sun";
}

export default function MmwMap({ initialEvents }: Props) {
  const [day, setDay] = useState<DayKey>("tue");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EventRecord | null>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [pulse, setPulse] = useState<PulseItem[]>([]);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<"none" | "lead" | "promo" | "save">("none");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialEvents
      .filter((event) => dayKeyFromEvent(event) === day)
      .filter((event) => {
        if (!q) return true;
        return `${event.title} ${event.venue} ${event.lineup.join(" ")}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.trending !== b.trending) return a.trending ? -1 : 1;
        return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      });
  }, [day, initialEvents, query]);

  useEffect(() => {
    const loadPulse = async () => {
      const res = await fetch("/api/pulse?limit=8", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { items: PulseItem[] };
      setPulse(json.items ?? []);
    };

    void loadPulse();
    const interval = setInterval(() => void loadPulse(), 15000);
    return () => clearInterval(interval);
  }, []);

  async function submitLead() {
    if (!leadEmail.includes("@")) return;
    setBusy("lead");
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: leadEmail,
          source: "mmw_guide_2026",
          eventId: selected?.id ?? null,
        }),
      });
    } finally {
      setBusy("none");
    }
  }

  async function revealPromo() {
    if (!selected) return;
    setBusy("promo");
    try {
      const res = await fetch(`/api/events/${selected.id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: leadEmail || undefined }),
      });
      const json = (await res.json()) as { promoCode?: string | null };
      setPromoCode(json.promoCode ?? null);
    } finally {
      setBusy("none");
    }
  }

  async function saveEvent() {
    if (!selected || !leadEmail.includes("@")) return;
    setBusy("save");
    try {
      await fetch(`/api/events/${selected.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: leadEmail }),
      });
    } finally {
      setBusy("none");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: BG, color: TXT }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, color: ACCENT, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>The Womb Network</p>
            <h1 style={{ margin: "8px 0 6px", fontSize: 38 }}>MMW 2026 Live Map</h1>
            <p style={{ margin: 0, color: MUTED }}>Production data API, underground links, promo reveal, and real-time Pulse feed.</p>
          </div>
          <div style={{ textAlign: "right", color: MUTED, fontSize: 13 }}>
            <div>{initialEvents.length} events indexed</div>
            <div>{pulse.length} pulse updates</div>
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {DAYS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => {
                    setDay(d.key);
                    setSelected(null);
                    setPromoCode(null);
                  }}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${day === d.key ? ACCENT : BORDER}`,
                    background: day === d.key ? "rgba(216,184,107,0.16)" : "transparent",
                    color: day === d.key ? ACCENT : TXT,
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              ))}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search artists, venues, events"
                style={{
                  marginLeft: "auto",
                  minWidth: 260,
                  borderRadius: 999,
                  border: `1px solid ${BORDER}`,
                  background: "#0d0d10",
                  color: TXT,
                  padding: "8px 14px",
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 10, maxHeight: 560, overflow: "auto", paddingRight: 4 }}>
              {filtered.map((event) => {
                const active = selected?.id === event.id;
                return (
                  <article
                    key={event.id}
                    onClick={() => {
                      setSelected(event);
                      setPromoCode(null);
                    }}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${active ? ACCENT : BORDER}`,
                      background: active ? "rgba(216,184,107,0.08)" : "#0f0f13",
                      padding: 14,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>{event.title}</strong>
                      <span style={{ color: MUTED, fontSize: 12 }}>{event.timeLabel}</span>
                    </div>
                    <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{event.venue} · {event.area}</div>
                    <div style={{ color: "#d4d4d8", fontSize: 12, marginTop: 6 }}>{event.lineup.slice(0, 4).join(" · ")}</div>
                  </article>
                );
              })}
              {filtered.length === 0 && <div style={{ color: MUTED }}>No events match current filters.</div>}
            </div>
          </div>

          <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Selected Event</h3>
              {!selected && <p style={{ color: MUTED, margin: 0 }}>Choose an event to reveal promo code and save to your inbox.</p>}
              {selected && (
                <>
                  <div style={{ fontWeight: 700 }}>{selected.title}</div>
                  <div style={{ color: MUTED, marginTop: 4, fontSize: 13 }}>{selected.venue} · {selected.day}</div>
                  <div style={{ marginTop: 10, color: "#d4d4d8", fontSize: 13 }}>{selected.lineup.join(" · ")}</div>
                  <input
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="Email for save/reveal"
                    style={{
                      width: "100%",
                      marginTop: 12,
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      background: "#0d0d10",
                      color: TXT,
                      padding: "10px 12px",
                    }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                    <button onClick={() => void revealPromo()} disabled={busy !== "none"} style={{ borderRadius: 10, border: "none", background: ACCENT, color: "#111", padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>
                      {busy === "promo" ? "Revealing..." : "Reveal Promo"}
                    </button>
                    <button onClick={() => void saveEvent()} disabled={busy !== "none"} style={{ borderRadius: 10, border: `1px solid ${BORDER}`, background: "transparent", color: TXT, padding: "10px 12px", cursor: "pointer" }}>
                      {busy === "save" ? "Saving..." : "Save Event"}
                    </button>
                  </div>
                  {promoCode && <p style={{ margin: "10px 0 0", color: ACCENT, fontWeight: 700 }}>Promo Code: {promoCode}</p>}
                </>
              )}
            </div>

            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>Plug Me In</h3>
              <p style={{ marginTop: 0, color: MUTED, fontSize: 13 }}>Capture lead directly into backend `/api/leads`.</p>
              <input
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="you@email.com"
                style={{ width: "100%", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#0d0d10", color: TXT, padding: "10px 12px" }}
              />
              <button onClick={() => void submitLead()} disabled={busy !== "none"} style={{ marginTop: 10, width: "100%", borderRadius: 10, border: "none", background: ACCENT, color: "#111", padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>
                {busy === "lead" ? "Submitting..." : "Submit Lead"}
              </button>
            </div>

            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }}>
              <h3 style={{ marginTop: 0 }}>The Pulse</h3>
              <div style={{ display: "grid", gap: 8, maxHeight: 220, overflow: "auto" }}>
                {pulse.length === 0 && <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No pulse updates yet.</p>}
                {pulse.map((item) => (
                  <div key={item.id} style={{ borderRadius: 10, border: `1px solid ${BORDER}`, padding: "8px 10px", background: "#0f0f13" }}>
                    <div style={{ fontSize: 11, color: ACCENT, textTransform: "uppercase", letterSpacing: 1 }}>{item.urgency}</div>
                    <div style={{ marginTop: 4, fontSize: 13 }}>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
