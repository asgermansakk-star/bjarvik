// Enkeltfilerne på den byggede bjarvik.com: søgeindekset, scripts og sidernes grundopbygning.
// Siderne bygges på Mac'en (byg-site.ps1 i vanta-system), så testene tjekker resultatet her i udgivelsesrepoet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const ROD = join(import.meta.dirname, "..", "..", "..");
const laes = (...p) => readFileSync(join(ROD, ...p), "utf8");
const indeks = (mappe = "") => { const c = { window: {} }; vm.runInNewContext(laes(mappe, "assets", "index.js"), c); return c.window.VANTA_INDEX; };

test("søgeindekset har én række pr. aktie med navn, slug og score 0–100", () => {
  for (const mappe of ["", "da"]) {
    const I = indeks(mappe);
    assert.ok(I.length > 1000, `${mappe || "en"}: kun ${I.length} aktier`);
    for (const [navn, slug, score, branche, land] of I) {
      assert.ok(navn && branche && land, `${slug} mangler felter`);
      assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `ugyldig slug: ${slug}`);
      assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `${slug}: score ${score}`);
    }
    assert.equal(new Set(I.map((r) => r[1])).size, I.length, "to aktier med samme slug");
  }
});

test("søgeindekset er sorteret efter score, højeste først", () => {
  const I = indeks();
  assert.ok(I.every((r, i) => i === 0 || I[i - 1][2] >= r[2]));
});

test("alle scripts kan læses af JavaScript", () => {
  for (const mappe of ["assets", "da/assets"]) {
    for (const f of readdirSync(join(ROD, mappe)).filter((f) => f.endsWith(".js"))) {
      assert.doesNotThrow(() => new vm.Script(laes(mappe, f), { filename: `${mappe}/${f}` }), `${mappe}/${f}`);
    }
  }
});

test("hovedsiderne har sprog, titel, beskrivelse, viewport og gyldige JSON-LD-data", () => {
  const sider = ["index.html", "rankings.html", "penny.html", "portfolio.html", "method.html", "404.html"];
  for (const [mappe, sprog] of [["", "en"], ["da", "da"]]) {
    for (const f of sider) {
      const html = laes(mappe, f), navn = `${mappe ? mappe + "/" : ""}${f}`;
      assert.match(html, new RegExp(`<html lang="${sprog}"`), navn);
      assert.match(html, /<title>[^<]{3,}<\/title>/, navn);
      assert.match(html, /<meta name="viewport"/, navn);
      if (f !== "404.html") assert.match(html, /<meta name="description" content="[^"]{20,}"/, navn);
      for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        assert.doesNotThrow(() => JSON.parse(json), `${navn}: ugyldig JSON-LD`);
      }
    }
  }
});
