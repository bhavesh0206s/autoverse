/**
 * Autoverse Background Service Worker — Phase 9 (Vite)
 */

const API = "http://localhost:8000";

let isRecording = false;
let currentSessionId: string | null = null;
let pendingCount = 0;

async function setState(recording: boolean, sessionId: string | null) {
  isRecording = recording;
  currentSessionId = sessionId;
  await chrome.storage.session.set({ isRecording: recording, currentSessionId: sessionId });
}

async function broadcastToTabs(msg: any) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    }
  }
}

async function postEvents(sessionId: string, events: any[]) {
  try {
    const resp = await fetch(`${API}/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
    if (resp.ok) {
      const json = await resp.json();
      pendingCount = json.data?.total ?? pendingCount + events.length;
    }
  } catch {
    /* Network errors ignored */
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case "CAPTURE_EVENTS":
      if (msg.sessionId && msg.events?.length) {
        postEvents(msg.sessionId, msg.events).then(() => sendResponse({ ok: true }));
      } else {
        sendResponse({ ok: false });
      }
      return true;

    case "START_RECORDING":
      console.log("START_RECORDING received for session:", msg.sessionId);
      setState(true, msg.sessionId).then(() => {
        broadcastToTabs({ type: "START_RECORDING", sessionId: msg.sessionId });
        sendResponse({ ok: true });
      });
      return true;

    case "STOP_RECORDING":
      console.log("STOP_RECORDING received");
      setState(false, null).then(() => {
        broadcastToTabs({ type: "STOP_RECORDING" });
        pendingCount = 0;
        sendResponse({ ok: true });
      });
      return true;

    case "GET_STATUS":
      sendResponse({ isRecording, currentSessionId, pendingCount });
      return false;
  }
});

let lastTabUrl: Record<number, string> = {};
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isRecording || !currentSessionId) return;
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (lastTabUrl[tabId] === tab.url) return;

  const from = lastTabUrl[tabId] ?? null;
  lastTabUrl[tabId] = tab.url;

  postEvents(currentSessionId, [
    {
      type: "navigation",
      timestamp: Date.now(),
      fromUrl: from,
      toUrl: tab.url,
      title: tab.title ?? null,
      method: "tab_update",
      url: tab.url,
    },
  ]);
});

// Re-hydrate and sync
chrome.storage.session
  .get(["isRecording", "currentSessionId"])
  .then((res) => {
    isRecording = res.isRecording ?? false;
    currentSessionId = res.currentSessionId ?? null;
    console.log("Background re-hydrated:", { isRecording, currentSessionId });

    if (isRecording && currentSessionId) {
      // If we reloaded while recording, make sure tabs know
      broadcastToTabs({ type: "START_RECORDING", sessionId: currentSessionId });
    }
  })
  .catch((err) => console.error("Re-hydration failed:", err));
