import React from "react";
import type { Notification } from "../types/game";

export function Notifications({ items }: { items: Notification[] }) {
  return (
    <div className="notif-stack">
      {items.map(n => (
        <div key={n.id} className={`notif notif-${n.type}`}>
          <strong>{n.title}</strong>
          <span>{n.body}</span>
        </div>
      ))}
    </div>
  );
}
