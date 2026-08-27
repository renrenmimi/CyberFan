// The appliance table. One synth patched four ways: three noise paths (broadband
// air, a resonant peak, a low rumble), five partials pinned to the blade-pass
// frequency, and a sawtooth for motor whine. The difference between a hair dryer
// and a window unit is these numbers, not different code.
//   f : [value at the lowest speed, value at full] in Hz, swept exponentially
//   g : gain at full throttle;  k : how sharply that gain climbs with the speed

export const DEVICES = [
{
  id:"fan", name:"Oscillating Fan", zh:"摇头电风扇", icon:"fan",
  gears:["1","2","3"], keys:["1","2","3"], gearLevel:[.38,.68,1], gearLabel:"speed",
  blades:4, rpm:[170,620], unit:"rpm", spin:{up:1.1,down:2.9},
  pin:true, shake:.55, cool:5.5,
  air :{g:.32,k:1.20,f:[280,2000],q:.7},
  res :{g:.085,k:1.5,f:[380,820],q:2.2},
  rum :{g:.10,k:1.1,f:[70,120],q:1.0},
  tone:{g:.070,k:1.5,harm:[1,.6,.35,.18,.08],beat:0},
  note:"Four blades at 620 rpm put the blade-pass tone at 41 Hz. The cage faces you, so air " +
       "leaves it radially and accelerates as it arrives — approaching air fills more of your view " +
       "every frame, and that is the whole trick. Pull the pin and the head swings, which pans the " +
       "noise across the stereo field and drags the ribbon with it."
},
{
  id:"ac", name:"Window A/C", zh:"窗式空调", icon:"ac",
  gears:["lo","hi"], keys:["L","H"], gearLevel:[.6,1], gearLabel:"blower",
  blades:35, rpm:[90,260], unit:"rpm", spin:{up:2.0,down:3.6},
  mode:{on:"DRY", off:"COOL"}, shake:.34, cool:8.0, coolAlt:3.2, dripRate:.45,
  air :{g:.30,k:1.10,f:[260,1400],q:.6},
  res :{g:.06,k:1.3,f:[300,600],q:1.8},
  rum :{g:.26,k:.90,f:[55,95],q:1.3},
  tone:{g:.022,k:1.5,harm:[1,.35,.15],beat:0},
  cycle:{on:11,off:7,ramp:1.8,label:"compressor",affects:["rum","tone"]},
  note:"The blower runs continuously; the compressor does not. It cuts in on its own timer, " +
       "shoves the whole box sideways, takes the bottom of the spectrum with it when it stops, and " +
       "leaves a puddle either way. The cold rolls down out of the louvres and over the lens."
},
{
  id:"dryer", name:"Hair Dryer", zh:"老式吹风机", icon:"dryer",
  gears:["I","II"], keys:["I","II"], gearLevel:[.55,1], gearLabel:"blast",
  blades:11, rpm:[4000,9000], unit:"rpm", spin:{up:.50,down:.80},
  mode:{on:"HOT", off:"COLD"}, shake:.70, cool:1.2, coolAlt:-6.0,
  air :{g:.30,k:1.30,f:[900,6500],q:.5},
  res :{g:.07,k:1.5,f:[1200,2600],q:3.0},
  rum :{g:.04,k:1.2,f:[90,150],q:1.0},
  tone:{g:.020,k:1.6,harm:[1,.4,.2],beat:0},
  whine:{g:.095,k:1.9,f0:[140,330],lp:[1200,5200]},
  note:"Pointed straight down the barrel at you, because a dryer drawn in profile blows past " +
       "your ear and this one should not. The only universal motor in the set, so it gets a " +
       "sawtooth: a buzzy stack at 330 Hz. Hot loads the motor and drags that pitch down eight " +
       "percent, the way a real one sags."
},
{
  id:"hand", name:"Palm-leaf Fan", zh:"蒲扇", icon:"hand",
  gears:["slow","brisk","frantic"], keys:["1","2","3"], gearLevel:[.35,.65,1], gearLabel:"wrist",
  blades:1, rpm:[26,104], unit:"swings/min", spin:{up:.9,down:1.6},
  manual:true, shake:.20, cool:2.2,
  air :{g:.05,k:1.4,f:[240,900],q:.7},
  res :{g:.02,k:1.5,f:[300,700],q:1.4},
  rum :{g:.02,k:1.2,f:[60,100],q:1.0},
  tone:{g:.006,k:1.8,harm:[1,.3],beat:0},
  note:"No motor, so there is nothing to hold a steady tone. Each swing fires its own burst of " +
       "noise through a band-pass that sweeps up and back down — a whoosh is a filter moving, not " +
       "a sample. Most of the air comes forward at you, the rest wipes across. Click or drag the " +
       "stage to fan it yourself."
},
];

export const PARTIALS = 5;
export const AMBIENT = 34.0;   // it is, as reported, extremely hot

// ── reading the table ───────────────────────────────────────────────────────
export const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
export const lerp  = (a,b,t) => a + (b-a)*t;
export const expLerp = (a,b,t) => a * Math.pow(b/a, t);   // the honest way to sweep a frequency
export const curve = (lv,k) => Math.pow(clamp(lv,0,1), k);
// A stopped motor is stopped. Without the taper the rotor would snap to its idle
// speed the instant the level leaves zero, and the blade-pass tone with it.
export const rpmOf = (d,lv) => lv < 1e-4 ? 0 : expLerp(d.rpm[0], d.rpm[1], lv) * Math.min(1, lv/.10);
