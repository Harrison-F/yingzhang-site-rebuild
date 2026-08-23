import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const routes = [
  ["home", "/"],
  ["1-2026off", "/1-2026off/"],
  ["2-doors-to-freedom", "/2-doors-to-freedom/"],
  ["3-2025off", "/3-2025off/"],
  ["4-tyranny-tracker", "/4-tyranny-tracker/"],
  ["5-fab9-brand", "/5-fab9-brand/"],
  ["6-dicators-laundromat", "/6-dicators-laundromat/"],
  ["7-esc-tyranny", "/7-esc-tyranny/"],
  ["8-nyid", "/8-nyid/"],
  ["9-fab9-environment", "/9-fab9-environment/"],
];
const viewports = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 393, height: 851 },
};
const sourceOrigin = "https://yingzhang.xyz";
const localOrigin = process.env.LOCAL_ORIGIN || "http://127.0.0.1:4173/yingzhang-site-rebuild";
const out = path.resolve("qa");
fs.mkdirSync(out, { recursive: true });

async function settle(page) {
  await page.addStyleTag({
    content: `
      video { visibility: hidden !important; }
      img[src$=".gif"], img[src*=".gif?"] { visibility: hidden !important; }
      * { animation-play-state: paused !important; }
      html { scroll-behavior: auto !important; }
    `,
  });
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const height = document.documentElement.scrollHeight;
    const step = Math.max(window.innerHeight, 900);
    for (let y = 0; y < height; y += step) {
      window.scrollTo(0, y);
      await pause(45);
    }
    window.scrollTo(0, 0);
    await pause(800);
  });
}

async function capture(context, origin, route, file) {
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response || !response.ok()) throw new Error(`${origin + route}: navigation failed`);
  await settle(page);
  const metrics = await page.evaluate(() => ({
    title: document.title,
    text: document.body.innerText.replace(/\b\d{1,2}:\d{2}\s(?:AM|PM)\b/g, "TIME"),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    images: [...document.images].map((image) => ({
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
    })),
    internalLinks: [...document.querySelectorAll("a[href]")]
      .map((link) => link.href)
      .filter((href) => href.includes("yingzhang") || href.includes("harrison-f.github.io")),
  }));
  await page.screenshot({ path: file, fullPage: true, timeout: 60000 });
  await page.close();
  return { ...metrics, consoleErrors };
}

function compareImages(sourceFile, localFile, diffFile) {
  const source = PNG.sync.read(fs.readFileSync(sourceFile));
  const local = PNG.sync.read(fs.readFileSync(localFile));
  if (source.width !== local.width || source.height !== local.height) {
    return { ratio: 1, differingPixels: source.width * source.height, dimensionMismatch: true,
      source: [source.width, source.height], local: [local.width, local.height] };
  }
  const diff = new PNG({ width: source.width, height: source.height });
  const differingPixels = pixelmatch(source.data, local.data, diff.data, source.width, source.height, {
    threshold: 0.12,
    includeAA: false,
  });
  fs.writeFileSync(diffFile, PNG.sync.write(diff));
  return { ratio: differingPixels / (source.width * source.height), differingPixels, dimensionMismatch: false };
}

const browser = await chromium.launch({ headless: true });
const report = [];
let failed = false;
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (request.resourceType() === "media" || request.url().includes("/editorbar.")) {
        await route.abort();
      } else {
        await route.continue();
      }
    });
    for (const [name, route] of routes) {
      const dir = path.join(out, viewportName);
      fs.mkdirSync(dir, { recursive: true });
      const sourceFile = path.join(dir, `${name}-source.png`);
      const localFile = path.join(dir, `${name}-local.png`);
      const diffFile = path.join(dir, `${name}-diff.png`);
      const source = await capture(context, sourceOrigin, route, sourceFile);
      const local = await capture(context, localOrigin, route, localFile);
      const comparison = compareImages(sourceFile, localFile, diffFile);
      const brokenImages = local.images.filter((image) => image.complete && image.naturalWidth === 0);
      const textMatches = source.text === local.text;
      const noOverflow = local.scrollWidth <= local.clientWidth + 1;
      const linksRewritten = local.internalLinks.every((href) => !href.startsWith(sourceOrigin));
      const passed = textMatches && noOverflow && linksRewritten && brokenImages.length === 0 && comparison.ratio < 0.01;
      if (!passed) failed = true;
      report.push({ viewport: viewportName, route, passed, textMatches, noOverflow, linksRewritten,
        brokenImages: brokenImages.length, sourceConsoleErrors: source.consoleErrors.length,
        localConsoleErrors: local.consoleErrors.length, comparison });
      console.log(`${passed ? "PASS" : "FAIL"} ${viewportName} ${route} diff=${(comparison.ratio * 100).toFixed(3)}% broken=${brokenImages.length}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
if (failed) process.exitCode = 1;
