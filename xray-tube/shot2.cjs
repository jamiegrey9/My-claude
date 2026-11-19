const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const scheme = process.argv[4]||'light';
const p = await b.newPage({ viewport: { width: +(process.argv[5]||1360), height: 1000 }, deviceScaleFactor: 1, colorScheme: scheme });
p.on('console', m => { if (m.type()!=='log') console.log('console', m.type(), m.text()) }); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file://' + process.cwd() + '/xray-tube-standalone.html');
const acts = JSON.parse(process.argv[6]||'[]');
for (const a of acts){ if (a[0]==='click') await p.click(a[1], { force: true, timeout: 5000 }); if (a[0]==='wait') await p.waitForTimeout(a[1]); if (a[0]==='eval') await p.evaluate(a[1]); }
await p.waitForTimeout(1500); await p.screenshot({ path: process.argv[3], fullPage: true }); await b.close(); })();
