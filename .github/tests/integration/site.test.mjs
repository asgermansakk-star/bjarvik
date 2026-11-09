// Siderne hænger sammen: hver aktie i indekset har sin side på engelsk og dansk, sitemap.xml peger kun på sider, der
// findes, og ingen interne links, billeder, scripts eller stylesheets er døde.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, normalize, relative } from "node:path";
import vm from "node:vm";

const ROD = join(import.meta.dirname, "..", "..", "..");

function* htmlFiler(mappe = ROD) {
  for (const e of readdirSync(mappe, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "_deploy") continue;
    const sti = join(mappe, e.name);
    if (e.isDirectory()) yield* htmlFiler(sti);
    else if (e.name.endsWith(".html")) yield sti;
  }
}
const findes = (sti) => existsSync(sti) && (statSync(sti).isFile() || existsSync(join(sti, "index.html")));

test("hver aktie i søgeindekset har sin side på engelsk og dansk", () => {
  const c = { window: {} };
  vm.runInNewContext(readFileSync(join(ROD, "assets", "index.js"), "utf8"), c);
  const mangler = [...c.window.VANTA_INDEX].map((r) => r[1]).filter((s) => !findes(join(ROD, "stocks", `${s}.html`)) || !findes(join(ROD, "da", "stocks", `${s}.html`)));
  assert.deepEqual(mangler, []);
});

test("sitemap.xml peger kun på sider, der findes", () => {
  const urls = [...readFileSync(join(ROD, "sitemap.xml"), "utf8").matchAll(/<loc>https:\/\/bjarvik\.com\/([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length > 1000);
  assert.deepEqual(urls.filter((u) => !findes(join(ROD, decodeURIComponent(u)))), []);
});

test("ingen døde interne links på sitet", () => {
  const doede = new Map();
  let links = 0;
  for (const side of htmlFiler()) {
    for (const [, url] of readFileSync(side, "utf8").matchAll(/\s(?:href|src)="([^"#?]*)[^"]*"/g)) {
      if (!url || /^(mailto:|tel:|javascript:|data:)/.test(url) || /\$\{|' ?\+|\+ ?'/.test(url)) continue;
      let maal;
      if (/^https?:\/\/bjarvik\.com\//.test(url)) maal = join(ROD, url.replace(/^https?:\/\/bjarvik\.com\//, ""));
      else if (/^[a-z]+:\/\//i.test(url) || url.startsWith("//")) continue;
      else if (url.startsWith("/")) maal = join(ROD, url);
      else maal = normalize(join(dirname(side), url));
      links++;
      if (!findes(decodeURIComponent(maal))) doede.set(relative(ROD, maal), relative(ROD, side));
    }
  }
  assert.ok(links > 10000, `kun ${links} links fundet`);
  assert.deepEqual([...doede].slice(0, 20), []);
});
