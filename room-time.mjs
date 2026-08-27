const partMap = (formatter, value) => Object.fromEntries(
  formatter.formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
);

export function localISODate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getRoomDateParts(value = new Date(), locale) {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const parts = partMap(formatter, value);
  return {
    weekday: parts.weekday.toUpperCase(),
    month: parts.month.toUpperCase(),
    day: parts.day,
    year: parts.year,
    iso: localISODate(value)
  };
}

export function getRoomTimeParts(value = new Date(), locale) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = partMap(formatter, value);
  return {
    hour: parts.hour.padStart(2, "0"),
    minute: parts.minute.padStart(2, "0"),
    second: parts.second.padStart(2, "0")
  };
}

export function createRoomClock(render, {
  now = () => new Date(),
  schedule = (callback, delay) => window.setTimeout(callback, delay),
  cancel = (timer) => window.clearTimeout(timer)
} = {}) {
  let timer = null;
  let running = false;

  const tick = () => {
    if (!running) return;
    const current = now();
    render(current);
    timer = schedule(tick, Math.max(50, 1000 - current.getMilliseconds()));
  };

  return {
    start() {
      if (running) return;
      running = true;
      tick();
    },
    stop() {
      running = false;
      if (timer !== null) cancel(timer);
      timer = null;
    },
    get running() {
      return running;
    }
  };
}
