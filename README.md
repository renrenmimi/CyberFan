# CyberFan!

A tiny placebo-cooling toy drawn like a warm, hand-inked 1940s–1950s cartoon. Pick an appliance, thump a mechanical speed button, turn up the racket, and watch an extremely optimistic thermometer surrender to the breeze. Expanding air rings and foreground speed lines send every gust toward the viewer instead of sideways across the room.

## Cooling cast

- **Retro Oscillating Fan** — spinning blade afterimages, a pull-up oscillation pin, a dancing red ribbon, and three increasingly unreasonable speeds.
- **Vintage Window AC** — moving louvers, compressor rumble, cold fog, dehumidify light, and the occasional cartoon drip.
- **Classic Hair Dryer** — icy cold mode or a deliberately counterproductive hot mode with a red glow and sparks.
- **Old-school Hand Fan** — follows the pointer; click the stage or use its special control for an extra flap, leaves, and flying sweat drops.

The sound is generated live with the Web Audio API. There are no audio files, frameworks, packages, analytics, accounts, or backend services.

The room-information wall uses the visitor's real local date and time. Temperature, humidity, wind direction, and “mental chill” are deliberately theatrical simulations—not sensor readings. The tear-off calendar and wind vane respond gently to the active appliance without competing with the main animation.

## Run locally

Serve this folder with any static server, for example:

```sh
python3 -m http.server 8770
```

Then open `http://127.0.0.1:8770/`. Audio starts only after pressing **Start the show**, which satisfies the browser's first-interaction requirement.

Keyboard controls: `1`–`4` switch appliances, `↑` / `↓` change speed, `Space` toggles power, and `M` triggers the special gimmick.

## Self-check

```sh
node verify.mjs
```

The self-check covers appliance configuration, local date/time formatting, clock scheduling and cleanup, keyboard hooks, responsive design hooks, reduced motion, and audio initialization. The interface was visually verified at 1440, 1024, 768, 390, and 360 CSS pixels.

The animation uses `requestAnimationFrame` with bounded fixed simulation steps. Reduced-motion preferences simplify both CSS and Canvas motion while leaving appliance state, speed, and feedback understandable.
