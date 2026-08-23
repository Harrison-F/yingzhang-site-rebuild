import assert from "node:assert/strict";
import process from "node:process";
import { chromium } from "playwright";

const origin = (process.env.SITE_ORIGIN || "https://harrison-f.github.io/yingzhang-site-rebuild").replace(/\/$/, "");
const routes = [
  "/",
  "/1-2026off/",
  "/2-doors-to-freedom/",
  "/3-2025off/",
  "/4-tyranny-tracker/",
  "/5-fab9-brand/",
  "/6-dicators-laundromat/",
  "/7-esc-tyranny/",
  "/8-nyid/",
  "/9-fab9-environment/",
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const route of routes) {
    const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(response?.ok(), `${route}: expected a successful response`);
    assert.equal(await page.title(), "Multidisciplinary creative director");
    assert((await page.locator("body").innerText()).trim().length > 20, `${route}: body text is unexpectedly empty`);
    console.log(`PASS route ${route}`);
  }

  await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
  await page.locator('a[href="./1-2026off"]:visible').first().click();
  await page.waitForURL((url) => url.pathname.endsWith("/1-2026off/"));
  console.log("PASS project-card navigation");

  await page.locator("a:visible", { hasText: "PROJECTS" }).first().click();
  await page.waitForURL((url) => url.pathname === "/yingzhang-site-rebuild/" && url.hash === "#work");
  assert.equal(await page.locator("#work").count(), 1);
  console.log("PASS project-page return navigation");

  for (const [label, hash] of [["ABOUT", "#section-about"], ["CONTACT", "#section-contact"]]) {
    await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
    await page.locator("a:visible", { hasText: label }).first().click();
    await page.waitForURL((url) => url.hash === hash);
    assert.equal(await page.locator(hash).count(), 1);
    console.log(`PASS ${label.toLowerCase()} anchor navigation`);
  }
} finally {
  await browser.close();
}
