"""
ActionExecutor — Interprets and executes JSON Action Plans via Playwright.
"""

import asyncio
import re
from datetime import datetime, timezone
from typing import Any, Optional

import structlog
from playwright.async_api import async_playwright

log = structlog.get_logger(__name__)


class ActionExecutor:
	def __init__(self, plan: dict, parameters: dict, storage_state: Optional[dict] = None):
		self.steps = plan.get("steps", [])
		self.storage_state = storage_state

		plan_params = plan.get("parameters", [])
		self.params = {p.get("name"): p.get("default") for p in plan_params if "name" in p}
		self.params.update(parameters)

		self.results = {}
		self.logs = []   
		self.browser = None
		self.context = None
		self.page = None

	def _resolve(self, value: Any) -> Any:
		"""Replace {{param_name}} with values from self.params."""
		if not isinstance(value, str):
			return value

		def replace(match):
			param_name = match.group(1).strip()
			return str(self.params.get(param_name, match.group(0)))

		return re.sub(r"\{{1,2}(.*?)\}{1,2}", replace, value)

	async def run(self) -> dict:
		"""Main execution loop."""
		async with async_playwright() as p:
			headless = self.params.get("headless", True)
			if isinstance(headless, str):
				headless = headless.lower() == "true"

			self.browser = await p.chromium.launch(headless=headless)
			self.context = await self.browser.new_context(storage_state=self.storage_state)
			self.page = await self.context.new_page()

			success = True
			step_index = 0
			error_msg = None

			try:
				while step_index < len(self.steps):
					step = self.steps[step_index]
					log.info("executor.step.start", index=step_index, action=step.get("action"))

					result = await self._execute_step(step, step_index)
					self.logs.append({
						"index": step_index,
						"action": step.get("action"),
						"timestamp": datetime.now(timezone.utc).isoformat(),
						**result
					})

					if result["status"] == "failed":
						success = False
						error_msg = result.get("detail", "Step failed")
						break

				
					if result.get("repeat") and "repeat_to" in step:
					
						try:
							step_index = int(step["repeat_to"])
							log.info("executor.loop.repeat", target=step_index)
							continue
						except (ValueError, TypeError):
							log.warning("executor.loop.invalid_index", target=step["repeat_to"])

					step_index += 1

			except Exception as e:
				log.error("executor.run.exception", error=str(e))
				success = False
				error_msg = str(e)
			finally:
				if self.context:
				
					try:
						self.storage_state = await self.context.storage_state()
					except:
						pass
				if self.browser:
					await self.browser.close()

			return {
				"success": success,
				"error": error_msg,
				"data": self.results,
				"logs": self.logs,
				"storage_state": self.storage_state
			}

	async def _execute_step(self, step: dict, idx: int) -> dict:
		action = step.get("action")
		selector = self._resolve(step.get("selector"))
		value = self._resolve(step.get("value"))
		label = step.get("label")
		optional = step.get("optional", False)
		timeout = step.get("timeout", 8000)

		try:
			if action == "navigate":
				url = self._resolve(step.get("url"))
				if not url:
					return {"status": "failed", "detail": "Missing URL for navigate"}
				await self.page.goto(url, wait_until="domcontentloaded", timeout=timeout)
				return {"status": "success", "detail": f"Navigated to {url}"}

			elif action == "wait":
				if not selector:
				
					await self.page.wait_for_load_state("networkidle", timeout=timeout)
					return {"status": "success", "detail": "Waited for network idle"}
				await self.page.wait_for_selector(selector, timeout=timeout)
				return {"status": "success", "detail": f"Found selector: {selector}"}

			elif action == "wait_ms":
				ms = int(step.get("ms", 1000))
				await asyncio.sleep(ms / 1000.0)
				return {"status": "success", "detail": f"Slept for {ms}ms"}

			elif action == "click":
				if not selector:
					return {"status": "failed", "detail": "Missing selector for click"}
				try:
					await self.page.click(selector, timeout=timeout)
					return {"status": "success", "detail": f"Clicked {selector}"}
				except Exception as e:
					if optional:
						return {"status": "skipped", "detail": f"Optional element {selector} not found"}
					raise e

			elif action == "type":
				if not selector:
					return {"status": "failed", "detail": "Missing selector for type"}
			
				try:
					tag_name = await self.page.eval_on_selector(selector, "el => el.tagName.toLowerCase()", timeout=2000)
					if tag_name == "select":
						await self.page.select_option(selector, label=str(value))
						return {"status": "success", "detail": f"Auto-selected {value} in <select>"}
				except:
				
					pass

				await self.page.fill(selector, str(value))
				return {"status": "success", "detail": f"Typed into {selector}"}

			elif action == "select":
				if not selector:
					return {"status": "failed", "detail": "Missing selector for select"}
				await self.page.select_option(selector, label=str(value))
				return {"status": "success", "detail": f"Selected {value} in {selector}"}

			elif action == "scroll":
				x = step.get("x", 0)
				y = step.get("y", 500)
				await self.page.evaluate(f"window.scrollBy({x}, {y})")
				return {"status": "success", "detail": f"Scrolled by {x}, {y}"}

			elif action == "extract":
				if not selector or not label:
					return {"status": "failed", "detail": "Missing selector/label for extract"}

				attr = step.get("attribute")
				elements = await self.page.query_selector_all(selector)

				extracted_values = []
				for el in elements:
					if attr in ["textContent", "innerText", "text"]:
						val = await el.text_content()
					elif attr:
						val = await el.get_attribute(attr)
					else:
						val = await el.inner_text()
					extracted_values.append(val.strip() if val else "")

			
				if label not in self.results:
					self.results[label] = []

				if isinstance(self.results[label], list):
					self.results[label].extend(extracted_values)
				else:
				
					self.results[label] = extracted_values

				return {"status": "success", "detail": f"Extracted {len(extracted_values)} items for {label}", "data": extracted_values}

			elif action == "extract_list":
			
				label = label or "results"
				if not selector:
					return {"status": "failed", "detail": "Missing selector for extract_list"}

				fields = step.get("fields", {})
				parents = await self.page.query_selector_all(selector)

				results = []
				for parent in parents:
					item = {}
					for field_name, config in fields.items():
					
						sub_sel = config if isinstance(config, str) else config.get("selector")
						sub_attr = None if isinstance(config, str) else config.get("attribute")

						if sub_sel in ["self", "current", ".", None, ""]:
							el = parent
						else:
							el = await parent.query_selector(sub_sel)
						if el:
							if sub_attr in ["textContent", "innerText", "text"]:
								val = await el.text_content()
							elif sub_attr:
								val = await el.get_attribute(sub_attr)
							else:
								val = await el.inner_text()
							item[field_name] = val.strip() if val else ""
						else:
							item[field_name] = None
					results.append(item)

				self.results[label] = results
				return {"status": "success", "detail": f"Extracted {len(results)} items into {label}", "data": results}

			elif action == "screenshot":
				path = f"/tmp/screenshot_{datetime.now().timestamp()}.png"
				await self.page.screenshot(path=path)
				return {"status": "success", "detail": f"Screenshot saved to {path}", "path": path}

			elif action == "click_if":
				if not selector:
					return {"status": "failed", "detail": "Missing selector for click_if"}

				el = await self.page.query_selector(selector)
				if el:
					await el.click()
					return {"status": "success", "detail": f"Clicked if-present element {selector}", "repeat": True}
				else:
					return {"status": "skipped", "detail": f"Element {selector} not found, stopping pagination if any", "repeat": False}

			else:
				return {"status": "skipped", "detail": f"Unknown action: {action}"}

		except Exception as e:
			log.error("executor.step.failed", action=action, error=str(e))
			return {"status": "failed", "detail": str(e)}
