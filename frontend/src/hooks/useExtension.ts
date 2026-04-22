import { useEffect, useState, useCallback } from "react";

interface ExtensionState {
  isInstalled: boolean;
  isRecording: boolean;
  currentSessionId: string | null;
  eventCount: number;
}

const DEFAULT: ExtensionState = {
  isInstalled: false,
  isRecording: false,
  currentSessionId: null,
  eventCount: 0,
};

export function useExtension(): ExtensionState & { refresh: () => void } {
  const [state, setState] = useState<ExtensionState>(DEFAULT);

  const refresh = useCallback(() => {
    // Check if content script has injected the attribute
    const isInstalled = document.documentElement.hasAttribute("data-autoverse-extension");

    if (!isInstalled) {
      setState({ ...DEFAULT, isInstalled: false });
      return;
    }

    // Request current state via postMessage bridge
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "AUTOVERSE_STATE") return;
      setState({
        isInstalled: true,
        isRecording: event.data.isRecording ?? false,
        currentSessionId: event.data.currentSessionId ?? null,
        eventCount: event.data.pendingCount ?? 0,
      });
      window.removeEventListener("message", handler);
    };

    window.addEventListener("message", handler);
    window.postMessage({ type: "AUTOVERSE_GET_STATE" }, "*");

    // Fallback: if no reply within 500ms, just mark installed
    setTimeout(() => {
      window.removeEventListener("message", handler);
      setState((prev) => (prev.isInstalled ? prev : { ...DEFAULT, isInstalled: true }));
    }, 500);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...state, refresh };
}
