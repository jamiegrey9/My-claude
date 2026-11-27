// One-screen page builder for equipment simulators (Node). Pairs with engine.js.
// pageHtml({ title, eyebrow, lede, figLabel, svg, parts, groups, steps, controls, result, css, data, script, kitCss })
// - svg: the figure <svg> string (kit figureSvg output, effect layers already in place)
// - parts: { id: { name, group, ... } } in display order; groups come from part.group
// - steps: [{ title, body }]
// - controls: HTML for the controls card body (2–3 controls); result: HTML for the result card body
// - data: object inlined as const DATA; script: device script that calls SimEngine({ data: DATA, ... })
// Output is an Artifact body (no doctype). Use standalone(html) for a file that opens on its own.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = readFileSync(join(HERE, "engine.js"), "utf8");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const BASE_CSS = `
:root{
  --bg:#efefeb;--surface:#fbfbfa;--ink:#18181a;--ink-2:#57575a;--muted:#8c8c90;--rule:#d9d9d5;
  --accent:#4b3fd6;--accent-soft:#4b3fd622;--on-accent:#fff;--heat:#d4561a;--heat-soft:#d4561a33;--e:#0b6e8a;--light:#2f7fd8;
  --font-display:"IBM Plex Sans Condensed","IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;
  --font-body:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --rail:clamp(290px,25vw,360px);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0b0b0c;--surface:#131314;--ink:#e8e8e6;--ink-2:#a3a3a3;--muted:#6e6e70;--rule:#2a2a2c;--accent:#9d94ff;--accent-soft:#9d94ff22;--on-accent:#0b0b0c;--heat:#ff8f4a;--heat-soft:#ff8f4a33;--e:#6fd3ef;--light:#7fc0ff;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0b0b0c;--surface:#131314;--ink:#e8e8e6;--ink-2:#a3a3a3;--muted:#6e6e70;--rule:#2a2a2c;--accent:#9d94ff;--accent-soft:#9d94ff22;--on-accent:#0b0b0c;--heat:#ff8f4a;--heat-soft:#ff8f4a33;--e:#6fd3ef;--light:#7fc0ff;color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 var(--font-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.app{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px;padding-block:12px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));max-width:1640px;margin:0 auto;background:var(--bg)}
.top{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap;min-width:0}
.top .eyebrow{font:500 10.5px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);width:100%}
.top h1{font:600 clamp(20px,2.2vw,28px)/1.1 var(--font-display);margin:0;letter-spacing:-.01em}
.top p{margin:0;color:var(--ink-2);font-size:13px;min-width:0;flex:1 1 320px}
.main{display:grid;grid-template-columns:minmax(0,1fr) var(--rail);gap:12px;min-height:0}
.figure-card{position:relative;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;background:var(--anatomy-card,var(--surface));border:1px solid var(--rule);border-radius:6px;overflow:hidden;--anatomy-paper:var(--anatomy-card)}
.stage{position:relative;min-height:0;outline:none}
.stage>svg{position:absolute;left:10px;right:10px;top:30px;bottom:6px;width:calc(100% - 20px);height:calc(100% - 36px);display:block;overflow:hidden!important}
.corner{position:absolute;font:500 10.5px/1 var(--font-mono);letter-spacing:.08em;color:var(--muted);pointer-events:none;z-index:1}
.corner.tl{top:12px;left:14px}.corner.tr{top:12px;right:14px;text-transform:uppercase}.corner.br{bottom:8px;right:14px;color:var(--ink-2);font-variant-numeric:tabular-nums}
.dock{display:flex;gap:6px;overflow-x:auto;padding:8px 12px 10px;border-top:1px solid var(--rule);scrollbar-width:thin;align-items:center}
.dock .grp{flex:none;font:500 9.5px/1 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-left:6px}
.dock .grp:first-child{margin-left:0}
.chip{flex:none;font:500 12px/1 var(--font-body);padding:7px 10px;border-radius:999px;border:1px solid var(--rule);background:var(--surface);color:var(--ink-2);cursor:pointer}
.chip:hover{color:var(--ink);border-color:var(--muted)}
.chip[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.rail{display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px;min-height:0;overflow:auto}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:12px 14px;min-height:0}
.card h2{font:600 11px/1 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2);margin:0 0 10px;display:flex;justify-content:space-between;gap:8px}
.card h2 small{font-weight:400;letter-spacing:.04em;text-transform:none;color:var(--muted)}
ol.steps{list-style:none;margin:0 0 10px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(26px,1fr));gap:4px}
ol.steps button{width:100%;height:26px;border:1px solid var(--rule);background:transparent;border-radius:4px;color:var(--muted);font:500 11.5px/1 var(--font-mono);cursor:pointer}
ol.steps button[aria-current="step"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
ol.steps button.done{color:var(--ink-2);border-color:var(--muted)}
.now h3{font:600 16px/1.2 var(--font-display);margin:0 0 4px}
.now p{margin:0;color:var(--ink-2);font-size:13px;line-height:1.45;min-height:7.3em}
.transport{display:flex;gap:6px;margin-top:10px}
.btn{flex:1;height:32px;border-radius:5px;border:1px solid var(--rule);background:var(--surface);color:var(--ink);font:500 12.5px/1 var(--font-body);cursor:pointer}
.btn:hover{border-color:var(--muted)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ctl{display:grid;grid-template-columns:62px minmax(0,1fr) 64px;align-items:center;gap:8px;margin:7px 0}
.ctl label,.ctl .lab{font:500 12px/1 var(--font-mono);color:var(--ink-2)}
.ctl output{font:500 12.5px/1 var(--font-mono);text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}
.ctl input[type=range]{width:100%;accent-color:var(--accent)}
.seg{display:flex;border:1px solid var(--rule);border-radius:5px;overflow:hidden;grid-column:2/4}
.seg button{flex:1;height:28px;border:0;background:transparent;color:var(--ink-2);font:500 12px/1 var(--font-body);cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--surface)}
.note{font-size:12px;color:var(--muted);margin:6px 0 0;line-height:1.4}
.result{display:flex;flex-direction:column;min-height:0}
.caption-quiet{font-size:11.5px;color:var(--muted);margin:6px 0 0;line-height:1.4}
button:focus-visible,input:focus-visible,.stage:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
/* parts, sections, pull-out, 3D */
.part{cursor:pointer}
.part:hover .iso-line{stroke:var(--anatomy-hi)}
.stage[data-focus] .part{opacity:.38;transition:opacity .25s}
.stage[data-lifted] .part{opacity:.62}
.stage[data-focus] .part[data-sel]{opacity:1}
.part[data-sel] .iso-line,.part[data-sel] .iso-edge{stroke:var(--accent)!important}
.part[data-sel] .cs{fill:var(--accent-soft)}
.cf{stroke-width:.5;stroke-linejoin:round}
.cf[data-shade="0"]{fill:var(--anatomy-shade-0);stroke:var(--anatomy-shade-0)}
.cf[data-shade="1"]{fill:var(--anatomy-shade-1);stroke:var(--anatomy-shade-1)}
.cf[data-shade="2"]{fill:var(--anatomy-shade-2);stroke:var(--anatomy-shade-2)}
.cf[data-shade="3"]{fill:var(--anatomy-shade-3);stroke:var(--anatomy-shade-3)}
.cf[data-shade="4"]{fill:var(--anatomy-top);stroke:var(--anatomy-top)}
.cf.glass{fill-opacity:.3;stroke-opacity:.3}
.cs{fill:var(--anatomy-face)}
.cs.cut-pb{fill:var(--anatomy-shade-0)}
.cs.cut-glass{fill:var(--anatomy-mid);fill-opacity:.3}
.cs.cut-cu{fill:var(--anatomy-shade-1)}
.fx{pointer-events:none}
.lift-layer{cursor:grab;filter:drop-shadow(0 10px 10px rgb(0 0 0 / .28)) drop-shadow(0 2px 2px rgb(0 0 0 / .18))}
.stage[data-dragging] .lift-layer{cursor:grabbing}
.stage[data-lifted] svg{touch-action:none}
.stage[data-lifted] .fx{opacity:.3}
.ghost{pointer-events:none}
.ghost .cf,.ghost .iso-shade,.ghost .iso-top,.ghost .cs,.ghost .tb-body,.ghost .tb-shine,.ghost .tb-shade,.ghost .tb-ring,.ghost .iso-dots,.ghost text,.ghost .iso-halo,.ghost .nofill{display:none}
.ghost .iso-fill{fill:var(--anatomy-shade-0);opacity:.55}
.ghost .iso-line,.ghost .iso-edge{stroke:var(--anatomy-mid)!important;stroke-dasharray:2 2.4;opacity:.8}
.view3d{position:absolute;z-index:3;touch-action:none;cursor:grab;filter:drop-shadow(.5px 0 0 var(--ink-2)) drop-shadow(-.5px 0 0 var(--ink-2)) drop-shadow(0 .5px 0 var(--ink-2)) drop-shadow(0 -.5px 0 var(--ink-2)) drop-shadow(0 12px 12px rgb(0 0 0 / .26))}
.view3d[hidden]{display:none}
.stage[data-dragging] .view3d{cursor:grabbing}
.grip{position:absolute;z-index:4;transform:translate(-50%,-100%);font:500 11px/1 var(--font-mono);letter-spacing:.06em;padding:6px 12px;border-radius:999px;border:1px solid var(--rule);background:var(--surface);color:var(--ink-2);cursor:move;touch-action:none;box-shadow:0 4px 10px -6px #0005}
.grip[hidden]{display:none}
.hover-tag{position:absolute;pointer-events:none;font:500 11px/1 var(--font-mono);padding:5px 7px;background:var(--surface);color:var(--ink);border:1px solid var(--rule);border-radius:3px;white-space:nowrap;transform:translate(10px,-130%);opacity:0;transition:opacity .12s;z-index:6}
.hover-tag[data-on]{opacity:1}
.pop{position:absolute;z-index:5;width:min(300px,86%);max-height:calc(100% - 16px);overflow:auto;background:var(--surface);border:1px solid var(--rule);border-radius:6px;box-shadow:0 12px 32px -12px #0006;padding:12px 14px;font-size:13px;line-height:1.5}
.pop[hidden]{display:none}
.pop .grp{font:500 10px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pop h3{font:600 17px/1.2 var(--font-display);margin:6px 0 2px;padding-right:24px}
.pop .role{color:var(--accent);font-weight:500;margin:0 0 6px}
.pop p{margin:0 0 8px;color:var(--ink-2)}
.pop dl{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin:0;font:12px/1.4 var(--font-mono)}
.pop dt{color:var(--muted)}
.pop dd{margin:0;color:var(--ink);font-variant-numeric:tabular-nums}
.pop .x{position:absolute;top:8px;right:8px;width:28px;height:28px;border:0;background:transparent;color:var(--muted);font-size:18px;line-height:1;cursor:pointer;border-radius:4px}
.pop .x:hover{background:var(--rule);color:var(--ink)}
.pop-status{font-size:12px;color:var(--muted)!important;margin:10px 0 0!important}
.pop-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.pop-actions .btn{height:30px;font-size:12px}
.pop-line{position:absolute;pointer-events:none;width:9px;height:9px;border-radius:50%;border:1.5px solid var(--accent);background:var(--surface);transform:translate(-50%,-50%);z-index:4}
.pop-line[hidden]{display:none}
@media (max-height:760px){.now p{min-height:5.9em;font-size:12.5px}.stage{padding-top:26px}.card{padding:10px 12px}.result .caption-quiet,.result .legend-row{display:none}}
@media (max-width:900px){
  body{overflow:auto}
  .app{height:auto;grid-template-rows:auto auto}
  .main{grid-template-columns:minmax(0,1fr)}
  .figure-card{height:min(80vh,580px)}
  .rail{overflow:visible}
  .pop{position:relative;width:auto;margin:8px;left:auto!important;top:auto!important;max-height:none}
  .corner.tr{display:none}
}
`;

export function pageHtml({ title, eyebrow = "", lede, figLabel = "", svg, parts, steps, controls, controlsTitle = "Controls", controlsNote = "", result, resultTitle = "Result", resultNote = "", css = "", data, script, kitCss = "" }) {
  const groups = [];
  for (const [id, p] of Object.entries(parts)) {
    let g = groups.find((x) => x.name === p.group);
    if (!g) groups.push((g = { name: p.group, ids: [] }));
    g.ids.push(id);
  }
  const dock = groups.map((g) => `<span class="grp">${esc(g.name)}</span>` + g.ids.map((id) => `<button class="chip" type="button" data-pick="${id}" aria-pressed="false">${esc(parts[id].name)}</button>`).join("")).join("");
  const body = `<title>${esc(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${kitCss}${BASE_CSS}${css}</style>
<div class="app iso">
  <header class="top">
    ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}
    <h1>${esc(title)}</h1>
    <p>${esc(lede)}</p>
  </header>
  <div class="main">
    <section class="figure-card" aria-label="${esc(title)} figure">
      <div class="stage" tabindex="0" aria-label="Figure. Use the part buttons below it to pull out any part.">
        <span class="corner tl">Fig 1</span><span class="corner tr">${esc(figLabel)}</span><span class="corner br" data-readout></span>
        ${svg}
        <div class="hover-tag" aria-hidden="true"></div><span class="pop-line" hidden></span><div class="pop" role="dialog" aria-live="polite" hidden></div>
      </div>
      <nav class="dock" aria-label="Parts">${dock}</nav>
    </section>
    <aside class="rail">
      <div class="card" aria-label="Process">
        <h2>${esc(data.processName || "Process")} <small data-phase>step 1 of ${steps.length}</small></h2>
        <ol class="steps">${steps.map((s, i) => `<li><button type="button" data-step="${i}" aria-label="Step ${i + 1}: ${esc(s.title)}">${i + 1}</button></li>`).join("")}</ol>
        <div class="now" aria-live="polite"><h3 data-st-title>${esc(steps[0].title)}</h3><p data-st-body>${esc(steps[0].body)}</p></div>
        <div class="transport"><button class="btn" type="button" id="back">Back</button><button class="btn primary" type="button" id="play">Play</button><button class="btn" type="button" id="next">Next</button></div>
      </div>
      <div class="card" aria-label="${esc(controlsTitle)}">
        <h2>${esc(controlsTitle)} ${controlsNote ? `<small>${esc(controlsNote)}</small>` : ""}</h2>
        ${controls}
      </div>
      <div class="card result" aria-label="${esc(resultTitle)}">
        <h2>${esc(resultTitle)} ${resultNote ? `<small data-result-note>${esc(resultNote)}</small>` : ""}</h2>
        ${result}
      </div>
    </aside>
  </div>
</div>
<script>
${ENGINE}
const DATA = ${JSON.stringify(data)};
${script}
</script>`;
  return body;
}

export function standalone(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${body}</body></html>`;
}
