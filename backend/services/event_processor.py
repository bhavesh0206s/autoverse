"""
Event processor — cleans and summarizes raw browser events before LLM ingestion.
"""

from __future__ import annotations

from typing import Any


def clean_events(raw_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
	"""
	Normalise a raw event list:
	- Remove INPUT events with empty/whitespace-only values
	- Remove duplicate consecutive SCROLL events (keep last position unless >500 px delta)
	- Merge rapid successive clicks on same selector (<100 ms) into one
	- Add sequence numbers
	- Calculate time_delta_ms between consecutive events
	"""
	if not raw_events:
		return []

	# ── Pass 1: basic filtering ───────────────────────────────────────────────
	pass1: list[dict] = []
	for ev in raw_events:
		t = ev.get("type", "")

		# Drop empty inputs
		if t == "input" and not str(ev.get("value", "")).strip():
			continue

		# Deduplicate consecutive scrolls
		if t == "scroll" and pass1 and pass1[-1].get("type") == "scroll":
			prev_y = pass1[-1].get("scrollY", 0) or pass1[-1].get("y", 0)
			curr_y = ev.get("scrollY", 0) or ev.get("y", 0)
			if abs(curr_y - prev_y) < 500:
				pass1[-1] = ev	# update with latest scroll position
				continue

		pass1.append(ev)

	# ── Pass 2: merge rapid identical clicks ──────────────────────────────────
	pass2: list[dict] = []
	for ev in pass1:
		if ev.get("type") == "click" and pass2:
			last = pass2[-1]
			if (last.get("type") == "click"
				and last.get("selector") == ev.get("selector")
				and (ev.get("timestamp", 0) - last.get("timestamp", 0)) < 100):
				continue  # skip rapid duplicate click
		pass2.append(ev)

	# ── Pass 3: add sequence + time_delta_ms ──────────────────────────────────
	result: list[dict] = []
	prev_ts: float | None = None
	for i, ev in enumerate(pass2):
		clean = {k: v for k, v in ev.items() if v is not None and v != ""}
		curr_ts = float(clean.get("timestamp", 0))
		clean["sequence"] = i + 1
		clean["time_delta_ms"] = int(curr_ts - prev_ts) if prev_ts is not None else 0
		prev_ts = curr_ts
		result.append(clean)

	return result


def summarize_events(events: list[dict[str, Any]]) -> dict[str, Any]:
	"""
	Produce a compact summary dict for LLM context.
	Returns: { total, by_type, unique_urls, unique_selectors, duration_ms }
	"""
	if not events:
		return {
			"total": 0,
			"by_type": {},
			"unique_urls": [],
			"unique_selectors": [],
			"duration_ms": 0,
		}

	by_type: dict[str, int] = {}
	urls: set[str] = set()
	selectors: set[str] = set()

	for ev in events:
		t = ev.get("type", "unknown")
		by_type[t] = by_type.get(t, 0) + 1
		if url := ev.get("url"):
			urls.add(url)
		if sel := ev.get("selector"):
			selectors.add(sel)

	timestamps = [float(ev["timestamp"]) for ev in events if ev.get("timestamp")]
	duration_ms = int(max(timestamps) -
					  min(timestamps)) if len(timestamps) > 1 else 0

	return {
		"total": len(events),
		"by_type": by_type,
		"unique_urls": sorted(urls)[:20],
		"unique_selectors": sorted(selectors)[:30],
		"duration_ms": duration_ms,
	}
