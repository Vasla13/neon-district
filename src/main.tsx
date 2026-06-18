import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "./types/game";
import { AccessScreen } from "./components/AccessScreen";
import { GameShell } from "./components/GameShell";
import "./styles/global.css";

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem("neon-session");
    return saved ? (JSON.parse(saved) as Session) : null;
  });

  function logout() {
    localStorage.removeItem("neon-session");
    setSession(null);
  }

  if (!session) {
    return <AccessScreen onSession={setSession} />;
  }

  return <GameShell session={session} onLogout={logout} />;
}

createRoot(document.getElementById("root")!).render(<App />);
