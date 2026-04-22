import { useEffect, useRef, useState } from "react";

type WSStatus = "connecting" | "connected" | "disconnected" | "error";

interface WSMessage {
  type: string;
  [key: string]: unknown;
}

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // ms

export function useWebSocket(sessionId: string | null) {
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [events, setEvents] = useState<WSMessage[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!sessionId) return;

    const connect = () => {
      const wsUrl = `${import.meta.env.VITE_WS_URL ?? "ws://localhost:8000"}/ws/sessions/${sessionId}`;
      setStatus("connecting");
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setStatus("connected");
        retries.current = 0;
      };

      ws.current.onmessage = (e) => {
        try {
          const msg: WSMessage = JSON.parse(e.data as string);
          setLastMessage(msg);
          setEvents((prev) => [...prev, msg]);
        } catch {
          // ignore non-JSON
        }
      };

      ws.current.onerror = () => setStatus("error");

      ws.current.onclose = () => {
        setStatus("disconnected");
        if (retries.current < MAX_RETRIES) {
          retries.current++;
          timer.current = setTimeout(connect, RETRY_DELAY * retries.current);
        }
      };
    };

    connect();

    return () => {
      clearTimeout(timer.current);
      ws.current?.close();
    };
  }, [sessionId]);

  return { events, status, lastMessage };
}
