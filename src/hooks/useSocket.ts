import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { Session, WorldState, ChatMessage, Notification } from "../types/game";
import { DistrictScene } from "../phaser/scenes/DistrictScene";
import { audio } from "./useAudio";

interface UseSocketReturn {
  world: WorldState | null;
  notifications: Notification[];
  sendChat: (text: string) => void;
  sendMove: (x: number, y: number) => void;
  completeMission: (id: string) => void;
  adminEvent: (name: string) => void;
  adminAnnounce: (text: string) => void;
  adminMute: (pseudo: string) => void;
  terminalInteract: () => void;
}

export function useSocket(
  session: Session | null,
  sceneRef: React.MutableRefObject<DistrictScene | null>,
  addNotification: (type: string, title: string, body: string) => void,
): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [notifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!session) return;

    const socket = io("/", {
      auth: { pseudo: session.pseudo, avatar: session.avatar, token: session.token },
    });
    socketRef.current = socket;

    socket.on("world", (w: WorldState) => {
      setWorld(w);
      sceneRef.current?.syncWorld(w.online, session.pseudo);
    });

    socket.on("chat", (msg: ChatMessage) => {
      setWorld(prev => {
        if (!prev) return prev;
        return { ...prev, chatLog: [...prev.chatLog.slice(-49), msg] };
      });
      sceneRef.current?.showSpeech(msg.pseudo, msg.text);
      if (msg.pseudo !== session.pseudo && msg.type !== "system") {
        audio.play("chat");
      }
    });

    socket.on("notification", (data: { type: string; title: string; body: string }) => {
      addNotification(data.type, data.title, data.body);
      audio.play("notification");
    });

    socket.on("sfx", (type: string) => {
      audio.play(type);
      if (type === "event") sceneRef.current?.triggerGlitchEffect();
    });

    socket.on("emote", (data: { pseudo: string; emote: string }) => {
      setWorld(prev => {
        const player = prev?.online.find(p => p.pseudo === data.pseudo);
        if (player) sceneRef.current?.showEmote(player.id, data.emote);
        return prev;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session]);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.emit("chat", text);
  }, []);

  const sendMove = useCallback((x: number, y: number) => {
    socketRef.current?.emit("move", { x, y });
  }, []);

  const completeMission = useCallback((id: string) => {
    socketRef.current?.emit("mission:complete", id);
  }, []);

  const adminEvent = useCallback((name: string) => {
    socketRef.current?.emit("admin:event", name);
  }, []);

  const adminAnnounce = useCallback((text: string) => {
    socketRef.current?.emit("admin:announce", text);
  }, []);

  const adminMute = useCallback((pseudo: string) => {
    socketRef.current?.emit("admin:mute", pseudo);
  }, []);

  const terminalInteract = useCallback(() => {
    socketRef.current?.emit("terminal:interact");
    socketRef.current?.emit("mission:complete", "signal-lost");
  }, []);

  return {
    world, notifications, sendChat, sendMove, completeMission,
    adminEvent, adminAnnounce, adminMute, terminalInteract,
  };
}
