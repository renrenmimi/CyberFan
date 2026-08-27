# CyberFan

**▶ [Open it](https://renrenmimi.github.io/CyberFan/)** — a static site, nothing to install.

It has been extremely hot. This is a small department of imaginary cooling: four
appliances drawn in the flat, inked, gouache-painted style of a 1940s cartoon, with
working gears, and every sound built at runtime out of oscillators and filtered
noise. There are no audio files and no images in the application — the drawing is
code and so is the sound.

![The room at 1440px: marquee, selector, thermometer, clock, calendar and a fan at speed three](docs/room-wide.png)

## Running it

`app.js` is an ES module, so the page must be **served**, not opened as a `file://`
URL. Any static server will do:

```bash
python3 -m http.server 8000
```

## Controls

| Action | |
|---|---|
| Pick an appliance | `1`–`4`, click a card, or arrow through the strip |
| Change speed | `↑` `↓`, or press a key on the plate |
| On / off | `Space` |
| Let the head swing | `P`, or pull the pin — fan only |
| Hot / cold, cool / dry | `H`, or flip the switch — dryer and A/C |
| Mute | `M`, or the speaker key |
| Fan by hand | click or drag the stage — palm-leaf fan |
| Volume | drag, scroll or arrow the knob |

Nothing makes a sound until you press the button on the curtain, because that is
the browser's rule. Headphones help; a lot of this sits below 100 Hz. Sound is
never required to understand anything.

## The wind blows at you, not past you

An early version had every appliance in profile, blowing to the right, and it read
as watching someone else get cooled off. The outlets now face the lens and the air
is built around one rule: **something approaching you at a constant speed covers
more of your view every frame.** Each streak leaves the outlet radially,
accelerates as its radius grows, and gets longer and fatter on the way.

Three things corroborate it, because a single cue is easy to disbelieve: a
tangential **swirl**, so the spray curves instead of reading as sunbeams; **broken
blast arcs** rather than closed ellipses, which read as circles drawn on a wall;
and **paper that reacts** — the calendar's bottom sheet lifts toward the camera and
a draught tag leans away from whichever outlet is running.

The camera is in the room, so gusts knock it about. The frost and the film grain
are on the lens instead, and deliberately do not move with it.

## One room, four different consequences

| | what it leaves behind |
|---|---|
| Oscillating fan | the head aims somewhere, so the draught tag leans *with* it and the ribbon on the cage is whipped by direction as well as speed |
| Window A/C | the compressor cuts in on its own timer, shoves the box sideways, fogs its own glass while it pulls, and drips into a puddle that evaporates |
| Hair dryer | a narrow, hot, forceful jet — it pulls at the calendar page three times harder than the window unit does |
| Palm-leaf fan | follows your hand across the stage, fires one synthesized whoosh per swing, and winds down on its own when you stop |

Hold anything at its top setting for eight seconds and the department drops by. It
happens at most once per page session, it is drawn on the canvas so it cannot cover
a control, and the page is entirely understandable without ever seeing it.

## The information wall

Three objects, one composition, no dashboard:

- **A school-room enamel clock** whose hands are the visitor's own local time. The
  seconds hand ticks. Hours and minutes are read straight from `Date` on the frame
  that draws them, so the hands need no timer at all.
- **A tear-off calendar** showing today, formatted with `Intl.DateTimeFormat` in the
  visitor's locale. Only a day or minute rollover reformats anything; a 15-second
  interval watches for one and is cleared on `pagehide` and whenever the tab is
  hidden.
- **A thermometer with a comfort strip.** Both readings are invented by the page and
  the plaque is stamped **SIMULATED**. The temperature is a function of how long
  something has been running; the humidity only moves for the air conditioner,
  because a fan does not take water out of the air.

## The narrow scene is a different drawing

![The same room at 390px, in portrait, with the hair dryer on hot](docs/room-portrait.png)

Below 680 px of stage width the canvas becomes 760 × 980 and `relayout()` re-places
every object: the wall furniture spreads across the top, the appliance moves to the
middle, the floor drops. It is a portrait framing of the same room, not the
landscape composition scaled down.

## How it is put together

```
index.html      markup only
styles.css      one token block, and every rule measured against it
devices.mjs     the appliance table plus the pure maths that reads it
room-time.mjs   Intl formatting and the day/minute rollover watcher
app.js          audio, canvas, drawing, interface, self-test
verify.mjs      static checks, run with node
```

No framework, no build step, no package manager, no dependency.

**One synth, four patches.** Three noise paths — broadband air, a resonant peak, a
low rumble — plus five harmonic partials and a sawtooth for motor whine. What makes
a hair dryer sound different from a window unit is a table of numbers, not
different code. Blade-pass frequency is computed rather than chosen: `rpm ÷ 60 ×
blades` sets the partials, so pitch follows the gear because the geometry says it
must.

**The simulation runs on a fixed 120 Hz step** and the renderer takes whatever frame
rate it gets — integrating the raw frame delta would make a fan spin up slower on a
slow machine, which is the one thing a spin-up time must not do. Audio parameters
are re-aimed every frame with `setTargetAtTime`, which behaves as a one-pole
follower: the same smoothing a motor changing speed already has. The graph is built
once, on the first real gesture, and never rebuilt, which is what lets one appliance
coast down while the next spins up instead of clicking.

**The ink line boils.** Golden-age cartoons were shot on twos — twelve new drawings
a second. Motion runs at 60, but every outline is re-wobbled only twelve times a
second, and the film grain re-seeds on the same clock.

**The plate is a named grid with fixed slots.** A control that does not apply to the
current appliance is disabled where it stands rather than removed, so switching
appliances never moves anything.

## Accessibility

- Roving tab index on the selector; `←` `→` `Home` `End` move between appliances.
- Every button has an accessible name; the volume knob is a `slider` with
  `aria-valuetext`; the canvas has a description of what it shows.
- One polite live region reports the appliance, its speed, the pin, the air mode,
  the mute and a short status line — only when something actually changed.
- Hidden text reports what the wall clock reads, refreshed on the minute.
- State is never colour alone: the depressed key prints a dot, the selected card
  draws a rule, disabled controls are hatched and say `n/a`.
- `prefers-reduced-motion` reaches the drawing as well as the stylesheet — the ink
  stops boiling, the camera stops being knocked about, bodies stop shaking, the
  seconds hand is withdrawn, the marquee sunburst stops, the curtain stops animating
  and the particle budget is cut. Nothing informative is lost.

## Verification

`node verify.mjs` — **113 checks**. It imports the appliance table rather than
scraping it, so the checks and the running app read the same source: gear levels
ascend to full throttle, every frequency sweep starts above zero, rpm leaves zero
continuously and rises monotonically, blade-pass partials stay inside the audible
band, the summed gain of all voices leaves the limiter headroom, coast-down outlasts
spin-up everywhere, and each gear reaches 95 % of its target in the 3τ its time
constant promises.

`index.html?selftest=1` — **32 assertions** against the live DOM, printed as a
report. Nothing is exposed on `window` and nothing runs without the flag. Layout
and overflow, plate stability across appliances, control↔state agreement, keyboard
operation, accessible names, the calendar matching today, a minute refresh, a day
rollover, interval cleanup, the curtain and its session memory, the status copy, the
inspection stamp's one-time behaviour, per-appliance paper pull, condensation
confined to the window unit, mute, reduced motion, and every appliance spinning up,
running and coasting to a stop.

Green at **320, 360, 390, 720** (which is 1440 at 200 % browser zoom), **768, 900,
1024 and 1440** px.

---

© 2026 Weiren Feng. All rights reserved.
Published for reading and portfolio purposes; not licensed for reuse, modification, or redistribution.
