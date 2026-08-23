import assert from "node:assert/strict";
import process from "node:process";
import { chromium } from "playwright";

const origin = (process.env.SITE_ORIGIN || "https://harrison-f.github.io/yingzhang-site-rebuild").replace(/\/$/, "");
const heroVideoRoutes = [
  "/1-2026off/",
  "/3-2025off/",
  "/4-tyranny-tracker/",
  "/5-fab9-brand/",
];

for (const route of heroVideoRoutes) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1902, height: 946 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

    const mediaResponses = [];
    const mediaFailures = [];
    page.on("response", (response) => {
      if (response.url().endsWith(".mp4")) {
        mediaResponses.push({ url: response.url(), status: response.status() });
      }
    });
    page.on("requestfailed", (request) => {
      if (request.url().endsWith(".mp4") && request.failure()?.errorText !== "net::ERR_ABORTED") {
        mediaFailures.push({ url: request.url(), error: request.failure()?.errorText });
      }
    });

    const started = Date.now();
    const response = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert(response?.ok(), `${route}: expected a successful document response`);

    await page.waitForFunction(() => {
      const topVideos = [...document.querySelectorAll("video")].filter((video) => {
        const rect = video.getBoundingClientRect();
        const style = getComputedStyle(video);
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
          && style.display !== "none" && style.visibility !== "hidden";
      });
      return topVideos.some((video) => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        && !video.paused && video.currentTime > 0.05 && !video.error);
    }, { timeout: 15000 });

    const metrics = await page.evaluate(() => ({
      brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length,
      playingTopVideos: [...document.querySelectorAll("video")].filter((video) => {
        const rect = video.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
          && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused
          && video.currentTime > 0.05 && !video.error;
      }).length,
    }));

    assert.equal(metrics.brokenImages, 0, `${route}: found broken images`);
    assert(metrics.playingTopVideos > 0, `${route}: no hero video reached playback`);
    assert(mediaResponses.some((item) => item.status === 200 || item.status === 206), `${route}: no successful MP4 response`);
    assert.deepEqual(mediaFailures, [], `${route}: unexpected MP4 request failures`);
    console.log(`PASS hero media ${route} startup=${Date.now() - started}ms responses=${mediaResponses.length}`);
    await context.close();
  } finally {
    await browser.close();
  }
}
