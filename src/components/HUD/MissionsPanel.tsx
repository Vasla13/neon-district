import React from "react";
import { MISSIONS } from "../../utils/constants";

interface Props {
  selected: typeof MISSIONS[number];
  onSelect: (m: typeof MISSIONS[number]) => void;
  completed: string[];
  onValidate: (id: string) => void;
  onClose: () => void;
}

export function MissionsPanel({ selected, onSelect, completed, onValidate, onClose }: Props) {
  return (
    <div className="panel">
      <div className="panel-header"><strong>Protocoles</strong><button onClick={onClose}>✕</button></div>
      {MISSIONS.map(m => (
        <button key={m.id} className={`mission-btn ${selected.id === m.id ? "active" : ""} ${completed.includes(m.id) ? "done" : ""}`} onClick={() => onSelect(m)}>
          <span className="mission-title">{completed.includes(m.id) ? "✓ " : ""}{m.title}</span>
          <span className="mission-reward">{m.reward}</span>
        </button>
      ))}
      <div className="mission-details">
        <strong>{selected.title}</strong>
        <p>{selected.body}</p>
        <span className="mission-hint">💡 {selected.hint}</span>
        {completed.includes(selected.id)
          ? <p className="mission-done-text">✓ Complete</p>
          : <button onClick={() => onValidate(selected.id)}>Valider</button>}
      </div>
    </div>
  );
}
