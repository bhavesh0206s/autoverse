"""
Seed script — creates 2 example workflows so the dashboard isn't empty on first load.
Run from the backend/ directory: python seed.py
"""

from __future__ import annotations

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

EXAMPLE_SCRIPT_1 = '''
import asyncio
import json
from playwright.async_api import async_playwright

async def run(playwright, **kwargs):
	query  = PARAMS.get("search_query", "Python automation")
	count  = int(PARAMS.get("max_results", 5))
	base   = PARAMS.get("headless", True)

	async with async_playwright() as pw:
		browser = await pw.chromium.launch(headless=base)
		page	= await browser.new_page()

		print(json.dumps({"step": 1, "status": "navigating", "data": "https://news.ycombinator.com"}))
		await page.goto("https://news.ycombinator.com")
		await page.wait_for_load_state("networkidle")

		results = []
		rows = await page.query_selector_all(".athing")
		for row in rows[:count]:
			try:
				title_el = await row.query_selector(".titleline > a")
				title	 = await title_el.inner_text() if title_el else ""
				href	 = await title_el.get_attribute("href") if title_el else ""
				results.append({"title": title, "url": href})
			except Exception:
				pass

		print(json.dumps({"step": 2, "status": "done", "data": f"Found {len(results)} items"}))
		await browser.close()
		print(json.dumps({"success": True, "data": results, "count": len(results)}))
'''.strip()

EXAMPLE_SCRIPT_2 = '''
import asyncio
import json
from playwright.async_api import async_playwright

async def run(playwright, **kwargs):
	url		= PARAMS.get("url", "https://example.com")
	headless= PARAMS.get("headless", True)

	async with async_playwright() as pw:
		browser = await pw.chromium.launch(headless=headless)
		page	= await browser.new_page()

		print(json.dumps({"step": 1, "status": "navigating", "data": url}))
		await page.goto(url, timeout=30000)
		await page.wait_for_load_state("networkidle")

		title  = await page.title()
		links  = await page.eval_on_selector_all("a[href]", "els => els.map(e => ({text: e.innerText.trim().slice(0, 100), href: e.href})).filter(x => x.href.startsWith('http')).slice(0, 20)")

		print(json.dumps({"step": 2, "status": "done", "data": f"Scraped {len(links)} links from {title}"}))
		await browser.close()
		print(json.dumps({"success": True, "data": links, "count": len(links)}))
'''.strip()


async def main() -> None:
	from database import create_all_tables, AsyncSessionLocal
	from models.workflow import Workflow

	print("Creating tables …")
	await create_all_tables()

	async with AsyncSessionLocal() as db:
		from sqlalchemy import select
		count = (await db.execute(select(Workflow))).scalars().all()
		if count:
			print(f"Already have {len(count)} workflows — skipping seed.")
			return

		wf1 = Workflow(
			name="Hacker News Scraper",
			description=
			"Scrapes top stories from Hacker News and returns them as a list.",
			parameters=[
				{
					"name": "search_query",
					"type": "string",
					"description": "Topic to filter by",
					"default": "Python",
					"required": False
				},
				{
					"name": "max_results",
					"type": "number",
					"description": "Max items to return",
					"default": 5,
					"required": False
				},
				{
					"name": "headless",
					"type": "boolean",
					"description": "Run headless",
					"default": True,
					"required": False
				},
			],
			steps=[
				{
					"step": 1,
					"name": "Navigate",
					"description": "Open Hacker News"
				},
				{
					"step": 2,
					"name": "Extract",
					"description": "Scrape top story titles and URLs"
				},
			],
			script=EXAMPLE_SCRIPT_1,
		)
		wf2 = Workflow(
			name="Page Link Extractor",
			description=
			"Crawls any URL and returns all external links found on the page.",
			parameters=[
				{
					"name": "url",
					"type": "string",
					"description": "URL to crawl",
					"default": "https://example.com",
					"required": True
				},
				{
					"name": "headless",
					"type": "boolean",
					"description": "Run headless",
					"default": True,
					"required": False
				},
			],
			steps=[
				{
					"step": 1,
					"name": "Navigate",
					"description": "Open target URL"
				},
				{
					"step": 2,
					"name": "Extract",
					"description": "Collect all external links"
				},
			],
			script=EXAMPLE_SCRIPT_2,
		)
		db.add_all([wf1, wf2])
		await db.commit()
		print("✅	 Seeded 2 example workflows!")


if __name__ == "__main__":
	asyncio.run(main())
