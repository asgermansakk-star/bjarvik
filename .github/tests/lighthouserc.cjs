// Performancetest med Lighthouse CI (npm run test:perf i .github/tests/). Hver side måles tre gange som mobil med
// langsom forbindelse (Lighthouses standard), og medianen skal klare grænserne. Rapporterne gemmes i test-resultater/lighthouse/.
// Grænserne er de samme som Sagsvagts; LCP svinger omkring 4 s på GitHubs maskiner, derfor 5 s.
const { existsSync } = require("node:fs");

const PORT = 4600;
const sider = ["", "rankings.html", "stocks/leonardo.html", "da/"];

// Lokalt bruges Playwrights Chromium; i GitHub Actions den Chrome, der følger med maskinen
let chromePath = process.env.CHROME_PATH;
if (!chromePath && !process.env.CI) {
  try { const p = require("@playwright/test").chromium.executablePath(); if (existsSync(p)) chromePath = p; } catch {}
}

const grænser = ({ ydeevne = 0.8, cls = 0.1 } = {}) => ({
  "categories:performance": ["error", { minScore: ydeevne, aggregationMethod: "median-run" }],
  "categories:accessibility": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
  "categories:best-practices": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
  "categories:seo": ["error", { minScore: 0.9, aggregationMethod: "median-run" }],
  "largest-contentful-paint": ["error", { maxNumericValue: 5000, aggregationMethod: "median-run" }],
  "cumulative-layout-shift": ["error", { maxNumericValue: cls, aggregationMethod: "median-run" }],
});

module.exports = {
  ci: {
    collect: {
      startServerCommand: "node server.mjs",
      startServerReadyPattern: "Testserver",
      url: sider.map((s) => `http://127.0.0.1:${PORT}/${s}`),
      numberOfRuns: 3,
      chromePath,
      settings: { chromeFlags: "--headless=new --no-sandbox" },
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: "^(?!.*(rankings\\.html|stocks/))", assertions: grænser() },
        // Kendte problemer målt 9/11-2026, som skal rettes i vanta-system (byg-site.ps1): ranglisten har 1.817 rækker i siden
        // og får 0,7 i ydeevne, og aktiesiderne flytter sig 0,27. Grænserne her fanger kun, at det bliver værre.
        { matchingUrlPattern: "rankings\\.html", assertions: grænser({ ydeevne: 0.6 }) },
        { matchingUrlPattern: "stocks/", assertions: grænser({ cls: 0.35 }) },
      ],
    },
    upload: { target: "filesystem", outputDir: "test-resultater/lighthouse" },
  },
};
