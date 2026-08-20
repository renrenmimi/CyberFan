// Checks the appliance table and the level dynamics without opening a browser.
// It reads the real numbers out of index.html rather than a copy, so the two
// cannot drift apart.  Run:  node verify.mjs
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./index.html", import.meta.url), "utf8");

// The table and the maths that reads it are one contiguous block in the source:
// everything from the appliance list down to rpmOf.
const cut = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error("could not find " + from + " … " + to);
  return src.slice(a, b);
};
const block = cut("const DEVICES = [", "const rpmOf =") +
              cut("const rpmOf =", "\n");
const { DEVICES, rpmOf, expLerp } =
  new Function(block + "\nreturn {DEVICES, rpmOf, expLerp};")();

let failed = 0, checked = 0;
const ok = (cond, label) => {
  checked++;
  if (!cond){ failed++; console.log("  FAIL  " + label); }
};

const keysOf = (name) => {
  const body = src.slice(src.indexOf(name), src.indexOf("\n};", src.indexOf(name)));
  return [...body.matchAll(/^\s{2}(\w+)[:(]/gm)].map(m => m[1]);
};
const drawKeys = keysOf("const DRAW = {");
const emitKeys = keysOf("const EMIT = {");

console.log("DEVICES: " + DEVICES.length + "\n");

// ── table integrity ─────────────────────────────────────────────────────────
ok(DEVICES.length <= 9, "at most nine devices, so every one has a digit key");
ok(new Set(DEVICES.map(d => d.id)).size === DEVICES.length, "device ids are unique");

for (const d of DEVICES){
  const t = "[" + d.id + "] ";
  ok(drawKeys.includes(d.render), t + "DRAW has a '" + d.render + "' renderer");
  ok(emitKeys.includes(d.render), t + "EMIT has a '" + d.render + "' emitter");

  ok(d.gears.length === d.gearLevel.length, t + "gear labels match gear levels");
  ok(d.gearLevel.every((v,i) => i === 0 || v > d.gearLevel[i-1]), t + "gear levels ascend");
  ok(d.gearLevel.at(-1) === 1, t + "top gear is full throttle");
  ok(d.gearLevel[0] > 0, t + "lowest gear is above zero");

  // expLerp divides by its first endpoint, so nothing may start at zero
  for (const [k, path] of Object.entries({air:d.air, res:d.res, rum:d.rum}))
    ok(path.f[0] > 0 && path.f[1] > path.f[0], t + k + " sweep is positive and rising");
  ok(d.rpm[0] > 0 && d.rpm[1] > d.rpm[0], t + "rpm range is positive and rising");
  if (d.whine) ok(d.whine.f0[0] > 0 && d.whine.lp[0] > 0, t + "whine ranges are positive");

  // a stopped motor must actually be stopped, and must leave zero continuously
  ok(rpmOf(d, 0) === 0, t + "rpm is exactly zero when off");
  ok(rpmOf(d, .001) < d.rpm[0] * .02, t + "rpm leaves zero without a jump");
  let mono = true, prev = -1;
  for (let lv = 0; lv <= 1.0001; lv += .01){ const r = rpmOf(d, lv); if (r < prev - 1e-9) mono = false; prev = r; }
  ok(mono, t + "rpm rises monotonically with the level");

  // partials have to stay inside the audible band or they alias
  const f0 = rpmOf(d, 1)/60 * d.blades;
  const top = f0 * d.tone.harm.length;
  ok(f0 > 18 && f0 < 3000, t + "blade pass at full gear is " + f0.toFixed(0) + " Hz");
  ok(top < 15000, t + "highest partial is " + top.toFixed(0) + " Hz");

  // everything sums into one bus, so the limiter needs headroom left over
  const partials = d.tone.harm.reduce((a,b) => a+b, 0) * (d.tone.beat ? 1.8 : 1);
  const peak = d.air.g + d.res.g + d.rum.g + d.tone.g*partials + (d.whine ? d.whine.g : 0);
  ok(peak < .85, t + "summed peak gain is " + peak.toFixed(3));

  // a driven motor spins up faster than it coasts down
  ok(d.spin.down > d.spin.up, t + "coast-down is slower than spin-up");

  if (d.cycle){
    ok(d.cycle.ramp * 2 < Math.min(d.cycle.on, d.cycle.off), t + "cycle ramp fits inside both phases");
    ok(d.cycle.affects.every(k => ["air","res","rum","tone"].includes(k)), t + "cycle targets real paths");
  }
}

// ── level dynamics ──────────────────────────────────────────────────────────
// The same integration the render loop runs. Reaching 95% of a one-pole target
// takes 3τ, so anything far off that means the loop and the spec disagree.
for (const d of DEVICES){
  for (const [gi, target] of d.gearLevel.entries()){
    let lv = 0, t = 0;
    const dt = 1/60;
    while (lv < target*.95 && t < 60){
      lv += (target - lv) * (1 - Math.exp(-dt/d.spin.up));
      t += dt;
    }
    const tau3 = 3 * d.spin.up;
    ok(t > tau3*.8 && t < tau3*1.35,
       "[" + d.id + "] gear " + d.gears[gi] + " reaches 95% in " + t.toFixed(2) + "s (3τ = " + tau3.toFixed(2) + "s)");
  }
  // and it must come back down, slower
  let up = 0, down = 0, lv = 1, t = 0;
  const dt = 1/60;
  while (lv > .05 && t < 90){ lv += (0 - lv) * (1 - Math.exp(-dt/d.spin.down)); t += dt; }
  down = t; up = 3*d.spin.up;
  ok(down > up, "[" + d.id + "] coasting to a stop (" + down.toFixed(1) + "s) outlasts spin-up (" + up.toFixed(1) + "s)");
}

console.log("\n" + (checked - failed) + "/" + checked + " checks passed");
process.exit(failed ? 1 : 0);
