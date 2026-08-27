import { readFile, access } from "node:fs/promises";
import { DEVICES } from "./devices.mjs";
import { createRoomClock, getRoomDateParts, getRoomTimeParts, localISODate } from "./room-time.mjs";

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "devices.mjs",
  "room-time.mjs",
  "favicon.svg",
  "assets/appliance-icons.svg"
];

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

await Promise.all(requiredFiles.map(async (file) => {
  try {
    await access(new URL(file, import.meta.url));
  } catch {
    failures.push(`Missing required file: ${file}`);
  }
}));

const [html, css, js, icons] = await Promise.all([
  readFile(new URL("index.html", import.meta.url), "utf8"),
  readFile(new URL("styles.css", import.meta.url), "utf8"),
  readFile(new URL("app.js", import.meta.url), "utf8"),
  readFile(new URL("assets/appliance-icons.svg", import.meta.url), "utf8")
]);

expect(DEVICES.length === 4, "CyberFan must have exactly four appliances.");
expect(new Set(DEVICES.map(({ id }) => id)).size === DEVICES.length, "Appliance ids must be unique.");
expect(DEVICES.map(({ key }) => key).join("") === "1234", "Appliance shortcuts must be 1–4.");

const sampleDate = new Date(2026, 7, 27, 15, 4, 5, 250);
const dateParts = getRoomDateParts(sampleDate, "en-US");
const timeParts = getRoomTimeParts(sampleDate, "en-US");
expect(localISODate(sampleDate) === "2026-08-27", "Calendar must produce the visitor's local ISO date.");
expect(dateParts.day === "27" && dateParts.month === "AUG" && dateParts.year === "2026", "Calendar parts are incorrect.");
expect(timeParts.hour === "15" && timeParts.minute === "04" && timeParts.second === "05", "Clock parts are incorrect.");

let scheduledTask = null;
let cancelledTimer = null;
let renderCount = 0;
const testClock = createRoomClock(() => { renderCount += 1; }, {
  now: () => sampleDate,
  schedule: (callback, delay) => {
    scheduledTask = { callback, delay };
    return 17;
  },
  cancel: (timer) => { cancelledTimer = timer; }
});
testClock.start();
expect(testClock.running && renderCount === 1, "Clock must render immediately when started.");
expect(scheduledTask?.delay === 750, "Clock must schedule its next update on the next second boundary.");
scheduledTask?.callback();
expect(renderCount === 2, "Clock must update on its scheduled tick.");
testClock.stop();
expect(!testClock.running && cancelledTimer === 17, "Clock cleanup must cancel its active timer.");

for (const device of DEVICES) {
  expect(device.gears?.length === 3, `${device.id} must have three mechanical speeds.`);
  expect(device.renderer, `${device.id} needs a canvas renderer.`);
  expect(device.palette?.main && device.palette?.trim, `${device.id} needs a cartoon palette.`);
  expect(device.sound?.cutoff?.length === 2, `${device.id} needs Web Audio filter bounds.`);
  expect(icons.includes(`id="${device.icon}"`), `Missing SVG symbol for ${device.id}.`);
}

for (const reference of ["styles.css", "app.js", "favicon.svg"]) {
  expect(html.includes(reference), `index.html must reference ${reference}.`);
}

expect(js.includes("AudioContext"), "Web Audio API setup is missing.");
expect(js.includes("requestAnimationFrame"), "Animation loop must use requestAnimationFrame.");
expect(js.includes("Math.min(1 / 120, remaining)"), "Simulation timestep must be bounded.");
expect(js.includes("window.addEventListener(\"keydown\""), "Keyboard operation is missing.");
expect(js.includes("pagehide") && js.includes("roomClock.stop()"), "Clock timer cleanup hook is missing.");
expect(js.includes("reducedMotionQuery"), "Canvas reduced-motion handling is missing.");
expect(html.includes("wallCalendar") && html.includes("wallClock"), "Room calendar or clock markup is missing.");
expect(html.includes("aria-live=\"polite\""), "Live appliance state announcement is missing.");
expect(html.includes("muteButton"), "Obvious sound mute control is missing.");
expect(css.includes("prefers-reduced-motion"), "Reduced-motion fallback is missing.");
expect(css.includes(".frost-vignette"), "Cartoon frost vignette is missing.");
expect(css.includes("--control-height") && css.includes("--touch-target"), "Shared control sizing tokens are missing.");
expect(css.includes("button:focus-visible"), "Keyboard focus styles are missing.");
expect(css.includes("@media (max-width: 520px)"), "Mobile layout breakpoint is missing.");

if (failures.length) {
  console.error(`CyberFan self-check failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`CyberFan self-check passed: ${DEVICES.length} appliances, ${requiredFiles.length} required files, local time lifecycle, keyboard, responsive, motion, and audio hooks present.`);
}
