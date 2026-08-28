// Static checks on the appliance table and the maths that reads it. The table is
// imported, not scraped, so it cannot drift from what the app runs; the coverage
// checks still read app.js as text, because that is where the drawing lives.
//   node verify.mjs
import { readFileSync } from "node:fs";
import { DEVICES, rpmOf } from "./devices.mjs";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

let failed = 0, checked = 0;
const ok = (cond, label) => { checked++; if (!cond){ failed++; console.log("  FAIL  " + label); } };

// which icons and which draw branches actually exist in the file
const iconSection = app.slice(app.indexOf("const ICONS = {"), app.indexOf("\n};", app.indexOf("const ICONS = {")));
const iconKeys = [...iconSection.matchAll(/^\s*(\w+):\s*$/gm)].map(m => m[1]);
const drawn = [...app.matchAll(/d\.id === "(\w+)"\)\s+draw/g)].map(m => m[1]);

console.log("DEVICES: " + DEVICES.length + "  ICONS: " + iconKeys.join(",") + "\n");

ok(DEVICES.length <= 9, "at most nine appliances, so every one has a digit key");
ok(new Set(DEVICES.map(d => d.id)).size === DEVICES.length, "appliance ids are unique");

// Link previews are part of the portfolio surface too. Absolute URLs let social
// crawlers build a useful card without executing the application.
for (const marker of [
  'rel="canonical"', 'property="og:title"', 'property="og:description"',
  'property="og:image"', 'name="twitter:card"', 'name="theme-color"'
]) ok(html.includes(marker), "document head includes " + marker);

ok(app.includes("startRenderLoop()") && app.includes("stopRenderLoop()"),
   "the renderer has explicit start and stop lifecycle hooks");
ok(app.includes('document.addEventListener("visibilitychange"'),
   "the renderer responds to page visibility");
ok(app.includes('$("curtain").addEventListener("click", () => { wake(); setGear(0); })'),
   "Start the show wakes the selected appliance in first gear");
ok(app.includes('$("curtain").addEventListener("pointerdown", e => e.stopPropagation())'),
   "the curtain keeps its press ahead of the global audio wake listener");

for (const d of DEVICES){
  const t = "[" + d.id + "] ";
  ok(iconKeys.includes(d.icon), t + "an icon named '" + d.icon + "' exists");
  ok(drawn.includes(d.id),      t + "the render loop has a branch for it");
  ok(typeof d.note === "string" && d.note.length > 40, t + "has a caption explaining itself");
  ok(typeof d.unit === "string", t + "declares the unit its readout is in");
  ok(typeof d.gearLabel === "string", t + "names its own speed control");

  ok(d.gears.length === d.gearLevel.length, t + "gear labels match gear levels");
  ok(d.gearLevel.every((v,i) => i === 0 || v > d.gearLevel[i-1]), t + "gear levels ascend");
  ok(d.gearLevel.at(-1) === 1, t + "top gear is full throttle");
  ok(d.gearLevel[0] > 0, t + "lowest gear is above zero");

  // expLerp divides by its first endpoint, so nothing may start at zero
  for (const [k, path] of Object.entries({air:d.air, res:d.res, rum:d.rum}))
    ok(path.f[0] > 0 && path.f[1] > path.f[0], t + k + " sweep is positive and rising");
  ok(d.rpm[0] > 0 && d.rpm[1] > d.rpm[0], t + "rpm range is positive and rising");
  if (d.whine) ok(d.whine.f0[0] > 0 && d.whine.lp[0] > 0, t + "whine ranges are positive");

  // a two-position switch needs a second cooling figure to switch to
  if (d.mode){
    ok(typeof d.mode.on === "string" && typeof d.mode.off === "string", t + "switch has both labels");
    ok(typeof d.coolAlt === "number", t + "switch has a second cooling figure");
    ok(d.coolAlt !== d.cool, t + "the two switch positions actually differ");
  }
  ok(typeof d.shake === "number" && d.shake >= 0 && d.shake <= 1, t + "shake is a sane fraction");
  ok(Math.abs(d.cool) <= 12, t + "cooling claim stays inside the thermometer's scale");

  // a stopped motor must be stopped, and must leave zero continuously
  ok(rpmOf(d, 0) === 0, t + "rpm is exactly zero when off");
  ok(rpmOf(d, .001) < d.rpm[0] * .02, t + "rpm leaves zero without a jump");
  let mono = true, prev = -1;
  for (let lv = 0; lv <= 1.0001; lv += .01){ const r = rpmOf(d, lv); if (r < prev - 1e-9) mono = false; prev = r; }
  ok(mono, t + "rpm rises monotonically with the level");

  // partials must stay inside the audible band or they alias
  const f0 = rpmOf(d, 1)/60 * d.blades, top = f0 * d.tone.harm.length;
  ok(f0 > 0 && f0 < 3000, t + "blade pass at full is " + f0.toFixed(0) + " Hz");
  ok(top < 15000, t + "highest partial is " + top.toFixed(0) + " Hz");

  // the continuous layer, the transients and the limiter share one output
  const partials = d.tone.harm.reduce((a,b) => a+b, 0) * (d.tone.beat ? 1.8 : 1);
  const peak = d.air.g + d.res.g + d.rum.g + d.tone.g*partials + (d.whine ? d.whine.g : 0);
  ok(peak < .85, t + "summed peak gain is " + peak.toFixed(3));

  ok(d.spin.down > d.spin.up, t + "coast-down is slower than spin-up");

  if (d.cycle){
    ok(d.cycle.ramp * 2 < Math.min(d.cycle.on, d.cycle.off), t + "cycle ramp fits inside both phases");
    ok(d.cycle.affects.every(k => ["air","res","rum","tone"].includes(k)), t + "cycle targets real paths");
  }
}

// ── level dynamics ──────────────────────────────────────────────────────────
// The same integration the fixed step runs. A one-pole target is 95% reached at
// 3τ, so a figure far off that means the loop and the table disagree.
for (const d of DEVICES){
  const dt = 1/120;
  for (const [gi, target] of d.gearLevel.entries()){
    let lv = 0, t = 0;
    while (lv < target*.95 && t < 60){ lv += (target - lv) * (1 - Math.exp(-dt/d.spin.up)); t += dt; }
    const tau3 = 3*d.spin.up;
    ok(t > tau3*.8 && t < tau3*1.35,
       "[" + d.id + "] gear " + d.gears[gi] + " reaches 95% in " + t.toFixed(2) + "s (3τ = " + tau3.toFixed(2) + "s)");
  }
  let lv = 1, t = 0;
  while (lv > .05 && t < 90){ lv += (0 - lv) * (1 - Math.exp(-dt/d.spin.down)); t += dt; }
  ok(t > 3*d.spin.up, "[" + d.id + "] coasting to a stop (" + t.toFixed(1) + "s) outlasts spin-up");
}

console.log("\n" + (checked - failed) + "/" + checked + " checks passed");
process.exit(failed ? 1 : 0);
