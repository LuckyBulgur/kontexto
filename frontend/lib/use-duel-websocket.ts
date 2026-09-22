"use client";

import { useEffect, useRef, useState } from "react";
import { DuelWsMessage } from "./duel-types";
import { wsBase } from "./ws-base";

interface UseDuelWebSocketOptions {
  duelId: string | null;
  token: string | null;
  onMessage?: (msg: DuelWsMessage) => void;
}

export function useDuelWebSocket({
  duelId,
  token,
  onMessage,
}: UseDuelWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!duelId || !token) return;

    const url = `${wsBase()}/duel/${duelId}?token=${token}`;
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let unmounted = false;

    function connect() {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg: DuelWsMessage = JSON.parse(event.data);
          onMessageRef.current?.(msg);
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
      wsRef.current = null;
    };
  }, [duelId, token]);

  return { connected };
}
