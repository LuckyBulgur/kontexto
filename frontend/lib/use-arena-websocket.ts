"use client";

import { useEffect, useRef, useState } from "react";
import { ArenaWsMessage } from "./arena-types";

const WS_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
    : "";

interface UseArenaWebSocketOptions {
  arenaId: string | null;
  token: string | null;
  onMessage?: (msg: ArenaWsMessage) => void;
}

/**
 * The arena's live channel. Same shape as the duel hook, including the 2 s
 * reconnect: an arena runs on a clock, so a socket that stays down is the one
 * failure a player actually notices.
 */
export function useArenaWebSocket({ arenaId, token, onMessage }: UseArenaWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!arenaId || !token) return;

    const url = `${WS_BASE}/arena/${arenaId}?token=${token}`;
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let unmounted = false;

    function connect() {
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (!unmounted) setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          onMessageRef.current?.(JSON.parse(event.data) as ArenaWsMessage);
        } catch {
          /* ignore malformed messages */
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setConnected(false);
          reconnectTimeout = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [arenaId, token]);

  return { connected };
}
