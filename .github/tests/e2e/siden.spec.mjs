// Besøgendes vej gennem bjarvik.com: forside, søgning, ranglisten, en aktie, den danske udgave og 404.
// Kun testserveren må kaldes; alt udefra afvises, så testen ikke afhænger af nettet.
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }, info) => {
  const fejl = [];
  await page.route((url) => !["127.0.0.1", "localhost"].includes(url.hostname), (r) => r.abort());
  page.on("pageerror", (e) => fejl.push(e.message));
  info.fejl = fejl;
});
test.afterEach(async ({}, info) => {
  expect(info.fejl, "JavaScript-fejl på siden").toEqual([]);
});

test("forsiden viser Bjarvik", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Bjarvik/);
  await expect(page.locator("h1")).toBeVisible();
});

test("søgefeltet finder en aktie og åbner dens side", async ({ page, isMobile }) => {
  test.skip(isMobile, "søgefeltet i toppen er kun synligt på computer");
  await page.goto("/");
  await page.locator("#gs-top input").fill("Leonardo");
  const hit = page.locator('#gs-top-res a[href$="stocks/leonardo.html"]');
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page).toHaveURL(/stocks\/leonardo\.html$/);
  await expect(page.locator("h1")).toHaveText(/Leonardo/);
});

test("ranglisten kan filtreres med søgning", async ({ page }) => {
  await page.goto("/rankings.html");
  await expect(page.locator("#count")).toHaveText(/^\d+ companies$/);
  await page.locator("#q").fill("Leonardo");
  await expect(page.locator("#count")).toHaveText(/^\d+ of \d+ companies$/);
  await expect(page.locator('#list li[data-name]:visible').first()).toContainText("Leonardo");
});

test("den danske udgave er på dansk", async ({ page }) => {
  await page.goto("/da/");
  await expect(page.locator("html")).toHaveAttribute("lang", "da");
  await expect(page.locator("h1")).toHaveText(/Alle aktier/);
});

test("en ukendt adresse giver Bjarviks 404-side", async ({ page }) => {
  const svar = await page.goto("/findes-ikke.html");
  expect(svar.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText(/Page not/);
});

test("ranglisten flyder ikke ud over skærmen", async ({ page }) => {
  await page.goto("/rankings.html");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
