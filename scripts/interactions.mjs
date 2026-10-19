import assert from "node:assert/strict";
import process from "node:process";
import { chromium } from "playwright";

const origin = (process.env.SITE_ORIGIN || "https://harrison-f.github.io/yingzhang-site-rebuild").replace(/\/$/, "");
const routes = [
  "/",
  "/1-dismantle/",
  "/2-doors-to-freedom/",
  "/3-imagine/",
  "/4-tyranny-tracker/",
  "/5-fab9-brand/",
  "/6-esc-tyranny/",
  "/7-dictators-laundromat/",
  "/8-nyid/",
  "/9-fab9-environment/",
];
const routeTitles = {
  "/": "YING ZHANG — CREATIVE DIRECTOR",
  "/1-dismantle/": "DISMANTLING DICTATORSHIP ",
  "/2-doors-to-freedom/": "DOORS TO FREEDOM",
  "/3-imagine/": "IMAGINE",
  "/4-tyranny-tracker/": "TYRANNY TRACKER",
  "/5-fab9-brand/": "YING ZHANG — CREATIVE DIRECTOR",
  "/6-esc-tyranny/": "ESC TYRANNY",
  "/7-dictators-laundromat/": "DICTATOR'S LAUNDROMAT",
  "/8-nyid/": "NYID",
  "/9-fab9-environment/": "FAB9 ENVIRONMENT",
};
const projectCards = [
  ["./1-dismantle", "DISMANTLING DICTATORSHIP", "/1-dismantle"],
  ["./2-doors-to-freedom", "DOORS TO FREEDOM", "/2-doors-to-freedom"],
  ["./3-imagine#first-project", "IMAGINE", "/3-imagine"],
  ["./4-tyranny-tracker", "TYRANNY TRACKER", "/4-tyranny-tracker"],
  ["./5-fab9-brand", "FAB9 BRAND", "/5-fab9-brand"],
  ["./6-esc-tyranny", "ESC TYRANNY", "/6-esc-tyranny"],
  ["./7-dictators-laundromat", "DICTATOR'S LAUNDROMAT", "/7-dictators-laundromat"],
  ["./8-nyid", "NYID", "/8-nyid"],
  ["./9-fab9-environment", "FAB9 ENVIRONMENT", "/9-fab9-environment"],
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const route of routes) {
    const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(response?.ok(), `${route}: expected a successful response`);
    const actualTitle = (await page.title()).trim();
    const expectedTitle = routeTitles[route].trim();
    assert.equal(actualTitle, expectedTitle, `${route}: unexpected page title`);
    assert((await page.locator("body").innerText()).trim().length > 20, `${route}: body text is unexpectedly empty`);
    console.log(`PASS route ${route}`);
  }

  for (const [href, title, route] of projectCards) {
    await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
    await page.locator(`a[href="${href}"]:visible`).filter({ hasText: title }).first().click();
    await page.waitForURL((url) => url.pathname.replace(/\/$/, "").endsWith(route));
    console.log(`PASS project-card navigation ${route}`);
  }

  await page.goto(origin + "/1-dismantle/", { waitUntil: "domcontentloaded" });
  await page.locator("a:visible", { hasText: "PROJECTS" }).first().click();
  await page.waitForURL((url) => url.pathname === "/yingzhang-site-rebuild/" && url.hash === "#work");
  assert.equal(await page.locator("#work").count(), 1);
  console.log("PASS project-page return navigation");

  for (const [label, hash] of [["CONTACT", "#section-contact"], ["PROJECTS", "#work"]]) {
    await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
    await page.locator("a:visible", { hasText: label }).first().click();
    await page.waitForURL((url) => url.hash === hash);
    assert.equal(await page.locator(hash).count(), 1);
    console.log(`PASS ${label.toLowerCase()} anchor navigation`);
  }
} finally {
  await browser.close();
}
