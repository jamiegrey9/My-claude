// Turns the built light page into a single themed page body for publishing:
// no doctype/html/head/body of its own, theme follows the viewer.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(HERE, "coffee-5400-light.html"), "utf8");
const style = page.match(/<style>([\s\S]*?)<\/style>/)[1]
  .replace(/html\{color-scheme:dark\}/, "")
  .replace(/body\[data-theme="light"\]\{color-scheme:light\}/, "")
  .replace(/body\{margin:0;background:var\(--anatomy-page\);[^}]*\}/, "")
  .replace(/\.iso-page\{[^}]*\}/, "");
const main = page.match(/<main class="iso-page">([\s\S]*?)<\/main>/)[1];
const script = page.match(/<script type="module">([\s\S]*)<\/script><\/body>/)[1];

const ROOT = `
:root{--pg:#f2f2ef;--ink:#57575a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--pg:#0b0b0b;--ink:#a3a3a3;color-scheme:dark}}
:root[data-theme="dark"]{--pg:#0b0b0b;--ink:#a3a3a3;color-scheme:dark}
body{background:var(--pg);color:var(--ink);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
.cf-wrap{background:var(--anatomy-page);color:var(--anatomy-text);min-height:100%}
.cf-inner{max-width:1320px;margin:0 auto;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.cf-intro{display:grid;gap:6px;margin:0 0 20px}
.cf-intro h1{margin:0;font:600 26px/1.15 ui-sans-serif,system-ui,sans-serif;letter-spacing:-.01em;color:var(--anatomy-strong);text-wrap:balance}
.cf-intro p{margin:0;max-width:68ch}
.cf-note{margin-top:14px;font-size:12px;color:var(--anatomy-muted)}
`;

const THEME = `
const wrap = document.querySelector(".cf-wrap");
const darkQ = matchMedia("(prefers-color-scheme: dark)");
const syncTheme = () => {
  const forced = document.documentElement.getAttribute("data-theme");
  wrap.setAttribute("data-theme", forced === "dark" || forced === "light" ? forced : darkQ.matches ? "dark" : "light");
};
syncTheme();
darkQ.addEventListener?.("change", syncTheme);
new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
`;

const intro = `<header class="cf-intro">
  <h1>How a Philips 5400 makes coffee</h1>
  <p>A cutaway of the machine with its right side panel and service door off. Pick a drink and press Brew: the part working at each stage lights up, water, steam, grounds and coffee move along their paths, and the readout shows temperature, pressure and volume as the cup fills.</p>
</header>`;

const out = `<title>Philips 5400 Cutaway</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${ROOT}${style}</style>
<div class="iso cf-wrap" data-theme="light"><div class="cf-inner">${intro}${main}<p class="cf-note">An unofficial explainer drawn from published specifications; not affiliated with Philips.</p></div></div>
<script type="module">${THEME}${script}</script>
`;
writeFileSync(join(HERE, "index.html"), out);
console.log("wrote index.html", `${(out.length / 1024).toFixed(0)} KB`);
