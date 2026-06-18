import React, { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../types/game";
import { ROLE_CSS } from "../../utils/constants";
import { audio } from "../../hooks/useAudio";

interface Props {
  messages: ChatMessage[];
  online: number;
  onSend: (text: string) => void;
}

export function ChatBox({ messages, online, onSend }: Props) {
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSend(clean);
    setText("");
    audio.play("click");
  }

  return (
    <div className="chat-box">
      <div className="chat-header"><strong>Chat</strong><span>{online} connectes</span></div>
      <div className="chat-messages" ref={logRef}>
        {messages.map(m => (
          <p key={m.id} className={m.type ? `msg-${m.type}` : ""}>
            <span className={`msg-author ${ROLE_CSS[m.role]}`}>{m.pseudo}</span>
            {m.text}
          </p>
        ))}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="/wave /talk VOLT /scan ..." maxLength={160} />
        <button type="submit">▶</button>
      </form>
    </div>
  );
}
