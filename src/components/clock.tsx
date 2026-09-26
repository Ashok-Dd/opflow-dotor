/**
 * A time like a good clock face: big even numbers, small AM / PM ("9 AM", not the typewriter "9  AM"), the same as
 * the app's ClockTime. ClockRange: "9 — 10 AM" (the first AM/PM left out when both are the same).
 */
const num = (h: number) => `${h % 12 === 0 ? 12 : h % 12}`;
const ap = (h: number) => (h % 24 >= 12 ? 'PM' : 'AM');

export function ClockTime({ hour, suffix = true }: { hour: number; suffix?: boolean }) {
  return (
    <span className="clock">
      <span className="n">{num(hour)}</span>
      {suffix ? <span className="ap">{ap(hour)}</span> : null}
    </span>
  );
}

export function ClockRange({ start, end, shortSame = true }: { start: number; end: number; shortSame?: boolean }) {
  const same = shortSame && ap(start) === ap(end);
  return (
    <span className="clock" aria-label={`${num(start)} ${ap(start)} to ${num(end)} ${ap(end)}`}>
      <span className="n">{num(start)}</span>
      {same ? null : <span className="ap">{ap(start)}</span>}
      <span className="dash" />
      <span className="n">{num(end)}</span>
      <span className="ap">{ap(end)}</span>
    </span>
  );
}
