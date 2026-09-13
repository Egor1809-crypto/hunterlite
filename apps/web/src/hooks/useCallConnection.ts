"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createWebSocket } from "@/lib/ws";
import { tryRefreshToken } from "@/lib/api";
import type { WSMessage } from "@/types";

/** Call transport never replays queued audio after reconnecting. */
export function useCallConnection(
  sessionId: string | null,
  onMessage: (message: WSMessage) => void,
) {
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const authenticated = useRef(false);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const sendMessage = useCallback((message: unknown) => {
    if (!authenticated.current || socket.current?.readyState !== WebSocket.OPEN)
      return false;
    socket.current.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;
    function connect() {
      if (disposed) return;
      const ws = createWebSocket("/ws/call");
      socket.current = ws;
      ws.onmessage = (event) => {
        if (disposed || socket.current !== ws) return;
        let message: WSMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === "auth.success") {
          authenticated.current = true;
          ws.send(
            JSON.stringify({ type: "start", data: { session_id: sessionId } }),
          );
          heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ type: "ping" }));
          }, 25_000);
          return;
        }
        if (message.type === "ready") {
          setConnected(true);
          attempts = 0;
        }
        if (message.type !== "pong") handler.current(message);
      };
      ws.onclose = async (event) => {
        if (disposed || socket.current !== ws) return;
        authenticated.current = false;
        setConnected(false);
        clearInterval(heartbeat);
        if (event.code === 1008 && !(await tryRefreshToken())) return;
        if (disposed) return;
        if (event.code === 4003 || attempts >= 8) {
          handler.current({
            type: "error",
            data: {
              message:
                "Соединение закрыто. Перезагрузите страницу для повторного подключения.",
            },
          } as WSMessage);
          return;
        }
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 15_000));
      };
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      authenticated.current = false;
      socket.current?.close();
      socket.current = null;
      setConnected(false);
    };
  }, [sessionId]);
  return { connected, sendMessage };
}
