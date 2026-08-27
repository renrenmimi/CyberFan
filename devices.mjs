export const DEVICES = [
  {
    id: "fan",
    key: "1",
    name: "Retro Oscillating Fan",
    short: "Retro Fan",
    zh: "经典摇头电风扇",
    icon: "fan",
    renderer: "fan",
    palette: { main: "#70b9c5", trim: "#e45143", pale: "#dff1e9" },
    blades: 4,
    rpm: [260, 1120],
    cooling: 5.4,
    gears: [
      { label: "1 · BREEZE", level: .32 },
      { label: "2 · BRISK", level: .64 },
      { label: "3 · GALE", level: 1 }
    ],
    mode: { label: "PULL OSCILLATION PIN", short: "OSCILLATE", kind: "oscillate" },
    sound: { air: .43, cutoff: [520, 3600], rumble: .08, motor: [46, 104], tone: .055 },
    caption: "Pull the brass pin, pick a clacky gear, and watch the red ribbon tell you exactly how windy it is."
  },
  {
    id: "ac",
    key: "2",
    name: "Vintage Window AC",
    short: "Window AC",
    zh: "复古大头空调",
    icon: "ac",
    renderer: "ac",
    palette: { main: "#d9cba8", trim: "#5a9ca9", pale: "#f8edcf" },
    blades: 18,
    rpm: [140, 680],
    cooling: 8.4,
    gears: [
      { label: "1 · FAN", level: .30 },
      { label: "2 · COOL", level: .66 },
      { label: "MAX · FREEZE", level: 1 }
    ],
    mode: { label: "DEHUMIDIFY LAMP", short: "DEHUMIDIFY", kind: "dry" },
    compressor: { on: 10, off: 4.5 },
    sound: { air: .38, cutoff: [390, 2500], rumble: .28, motor: [50, 79], tone: .045 },
    caption: "Its compressor wakes with a floor-shaking hum, the louvers nod, and a suspicious little drip forms underneath."
  },
  {
    id: "dryer",
    key: "3",
    name: "Classic Hair Dryer",
    short: "Hair Dryer",
    zh: "老式吹风机",
    icon: "dryer",
    renderer: "dryer",
    palette: { main: "#db6659", trim: "#f0c45d", pale: "#f7dfba" },
    blades: 9,
    rpm: [3600, 12500],
    cooling: 2.9,
    gears: [
      { label: "1 · PUFF", level: .34 },
      { label: "2 · WHOOSH", level: .68 },
      { label: "MAX · BLAST", level: 1 }
    ],
    mode: { label: "COLD / HOT TOGGLE", short: "HOT AIR", kind: "heat" },
    sound: { air: .49, cutoff: [1300, 8400], rumble: .035, motor: [155, 415], tone: .13 },
    caption: "Cold mode spits ice crystals. Hot mode glows cherry red, throws sparks, and very much does not lower the thermometer."
  },
  {
    id: "handfan",
    key: "4",
    name: "Old-school Hand Fan",
    short: "Hand Fan",
    zh: "手摇芭蕉扇",
    icon: "handfan",
    renderer: "handfan",
    palette: { main: "#78aa70", trim: "#d99a4e", pale: "#f0e0a6" },
    blades: 1,
    rpm: [38, 190],
    cooling: 4.1,
    gears: [
      { label: "1 · LAZY", level: .28 },
      { label: "2 · FLAP", level: .61 },
      { label: "MAX · PANIC", level: 1 }
    ],
    mode: { label: "CLICK FOR EXTRA FLAP", short: "EXTRA FLAP", kind: "manual" },
    sound: { air: .31, cutoff: [420, 2900], rumble: .015, motor: [34, 74], tone: .012 },
    caption: "Move over the stage to aim it. Click for an extra-hard flap that shakes loose leaves and cartoon sweat drops."
  }
];

export const AMBIENT_TEMPERATURE = 38;
export const FREEZE_TEMPERATURE = 16;
