"use client";

import { useEffect, useRef } from "react";
import type { WordleDuelWsMessage } from "./wordle-types";

interface UseWordleDuelWsOptions {
  duelId: string | null;
  token: string | null;
  onMessage: (msg: WordleDuelWsMessage) => void;
}

export function useWordleDuelWs({ duelId, token, onMessage }: UseWordleDuelWsOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!duelId || !token) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/wordle/duel/${duelId}?token=${token}`;
      ws = new WebSocket(url);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WordleDuelWsMessage;
          onMessageRef.current(msg);
        } catch {}
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [duelId, token]);
}
