// The wall's sense of time. The visitor's own locale and clock, formatted only
// when a day or a minute actually turns over — the hands on the canvas read Date
// directly on the frame that draws them and need no timer at all.

export const FMT = {
  weekday: new Intl.DateTimeFormat(undefined, {weekday:"short"}),
  month:   new Intl.DateTimeFormat(undefined, {month:"long"}),
  day:     new Intl.DateTimeFormat(undefined, {day:"numeric"}),
  year:    new Intl.DateTimeFormat(undefined, {year:"numeric"}),
  time:    new Intl.DateTimeFormat(undefined, {hour:"2-digit", minute:"2-digit"}),
};
export const CLOCK = {parts:null, dayKey:"", minuteKey:"", timer:0};

// Formatting is the expensive part, so it happens when the day or the minute
// turns over — not sixty times a second. The hands read the clock directly.
export function refreshDate(now){
  const dayKey = now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
  if (dayKey !== CLOCK.dayKey){
    CLOCK.dayKey = dayKey;
    CLOCK.parts = {
      weekday: FMT.weekday.format(now).toUpperCase(),
      month:   FMT.month.format(now).toUpperCase(),
      day:     FMT.day.format(now),
      year:    FMT.year.format(now),
    };
  }
  const minuteKey = now.getHours() + ":" + now.getMinutes();
  if (minuteKey !== CLOCK.minuteKey){
    CLOCK.minuteKey = minuteKey;
    const el = document.getElementById("wallTime");
    if (el && CLOCK.parts)
      el.textContent = "Wall clock reads " + FMT.time.format(now) + ", " +
                       CLOCK.parts.weekday + " " + CLOCK.parts.day + " " + CLOCK.parts.month;
  }
}
export function startClock(){ refreshDate(new Date()); stopClock();
                       CLOCK.timer = setInterval(() => refreshDate(new Date()), 15000); }
export function stopClock(){ if (CLOCK.timer){ clearInterval(CLOCK.timer); CLOCK.timer = 0; } }
addEventListener("pagehide", stopClock);
document.addEventListener("visibilitychange", () => document.hidden ? stopClock() : startClock());
