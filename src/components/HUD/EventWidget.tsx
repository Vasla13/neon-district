import React, { useEffect, useState } from "react";
import type { GameEvent } from "../../types/game";

export function EventWidget({ event }: { event: GameEvent | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeLeft = event?.until ? Math.max(0, event.until - now) : 0;
  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div className="event-widget">
      <span className="ew-label">Event actif</span>
      <span className="ew-name">{event?.name ?? "—"}</span>
      <span className="ew-desc">{event?.description ?? ""}</span>
      {event?.active && <span className="ew-timer">{mins}:{secs.toString().padStart(2, "0")}</span>}
    </div>
  );
}
