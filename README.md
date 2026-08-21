# CyberFan

**▶ [Open it](https://renrenmimi.github.io/cyberfann/)** — runs in your browser, nothing to install.

It has been extremely hot. This is a small department of imaginary cooling: four
appliances drawn in the flat, inked, gouache-painted style of a 1940s cartoon, with
working gears, and every sound built at runtime out of oscillators and filtered
noise. There are no audio files and no images in this repository — the drawing is
code and so is the sound.

![The four appliances at full speed](docs/appliances.png)

*Oscillating fan, window A/C, hair dryer, palm-leaf fan — each at its top setting*

## Controls

| Action | |
|---|---|
| Pick an appliance | `1`–`4`, or click a tab |
| Change speed | `↑` `↓`, or press a key on the plate |
| On / off | `Space` |
| Let the head swing | `P`, or pull the pin — fan only |
| Hot / cold, cool / dry | `H`, or flip the switch — dryer and A/C |
| Fan by hand | click or drag the stage — palm-leaf fan |
| Volume | drag or scroll the knob |

Headphones help. A lot of this sits below 100 Hz.

## The wind blows at you, not past you

The first version had every appliance in profile, blowing to the right, and it read
as watching someone else get cooled off. So the outlets were turned to face the lens
and the air was rebuilt around one rule: **something approaching you at a constant
speed covers more of your view every frame.** Each streak therefore leaves the outlet
radially, accelerates as its radius grows, and gets longer and fatter on the way —
then leaves frame past your head.

Three things were added to corroborate it, because a single cue is easy to disbelieve:

- **Swirl.** A rotor throws air outward *and around*. Each streak's angle drifts as it
  travels, so the spray curves. Without this the streaks read as sunbeams.
- **Broken blast arcs.** Expanding rings, drawn as two or three tapered arc segments
  with gaps rather than a closed ellipse — a closed one reads as a circle somebody drew
  on the wall.
- **A calendar on the wall.** Its bottom page lifts *toward the camera* and widens as it
  lifts. One piece of paper in the room settles the question of which way the air is
  going.

The camera is also in the room, so gusts knock it about. The frost and the film grain
are on the lens instead, and deliberately do not move with it.

## What is in it

- **One synth, four patches.** Three noise paths — broadband air, a resonant peak, a low
  rumble — plus five harmonic partials and a sawtooth for motor whine. What makes a hair
  dryer sound different from a window unit is a table of numbers, not different code.
- **Blade-pass frequency is computed, not chosen.** `rpm ÷ 60 × blades` sets the partials,
  so pitch follows the gear because the geometry says it must. Four blades at 620 rpm land
  on 41 Hz; eleven at 9,000 land on 1,650.
- **Spin-up and coast-down are asymmetric.** A motor is driven up and then left to coast,
  so every appliance carries two time constants: 0.50 s and 0.80 s for the dryer, 2.0 and
  3.6 for the air conditioner.
- **The ink line boils.** Golden-age cartoons were shot on twos — twelve new drawings a
  second. Motion here runs at 60, but every outline is re-wobbled only twelve times a
  second, so the line crawls the way a hand-inked one does. The film grain re-seeds on the
  same clock.
- **Squash and stretch.** Bodies shake and pulse with the speed, and the two scale factors
  multiply to one, so a thing keeps its volume the way a drawn character does.
- **Transients are synthesized too.** The clack of a key is a filtered noise burst plus a
  decaying tick. The palm fan has no motor to hold a tone, so each swing fires its own
  burst through a band-pass that sweeps up and back down — a whoosh is a filter moving,
  not a sample.
- **The compressor runs its own clock.** It cuts in and out on a timer, shoves the box
  sideways when it starts, takes the bottom of the spectrum with it when it stops, and
  drips into a puddle that slowly evaporates.
- **A ribbon tied to the cage**, eight verlet points with a length constraint, simulated on
  the fixed step rather than in the paint pass. It is the cheapest thing on the page that
  makes wind look real, because it lags.
- **A placebo thermometer.** It reads 34 °C, plunges while something runs, frosts over,
  cracks, and finally loses its tip. Nothing is measured and the page says so. The dryer's
  heat switch sends it the other way.

## Tech

Canvas 2D and the Web Audio API. No runtime dependencies, no build step, one HTML file.

The simulation runs on a fixed 120 Hz step and the renderer takes whatever frame rate it
gets — integrating the raw frame delta instead would make a fan spin up slower on a slow
machine, which is the one thing a spin-up time must not do. Audio parameters are re-aimed
every frame with `setTargetAtTime`, which behaves as a one-pole follower: the same
smoothing a motor changing speed already has.

The graph is built once, on the first real gesture, and never rebuilt — which is what lets
one appliance coast down while the next spins up instead of clicking. `resume()` is retried
on every later gesture in case the first was refused, so there is no silent-and-no-error
state.

Interface chrome is DOM, not canvas: the keys, the pin, the flip switch and the knob are
real buttons with real focus rings and keyboard handling, and their press-and-rebound is a
CSS spring. Tab artwork is inline SVG, grouped by part, so it stays crisp at any zoom.
`prefers-reduced-motion` collapses the transitions.

## Verification

`node verify.mjs` reads the appliance table and the level integration straight out of
`index.html` — not a copy — and runs 113 checks: every appliance has an icon and a render
branch, gear levels ascend to full throttle, every frequency sweep starts above zero, rpm
leaves zero continuously and rises monotonically, blade-pass partials stay inside the
audible band, the summed gain of all voices leaves the limiter headroom, a two-position
switch has a second cooling figure to switch to, coast-down outlasts spin-up everywhere,
and each gear reaches 95 % of its target in the 3τ its time constant promises.

---

© 2026 Weiren Feng. All rights reserved.
Published for reading and portfolio purposes; not licensed for reuse, modification, or redistribution.
