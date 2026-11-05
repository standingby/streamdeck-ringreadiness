/** Oura days are local calendar days, so everything here formats in local time. */

export function toLocalDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** The local date `offset` days from `from` (negative = past). */
export function shiftDate(day: string, offset: number): string {
	const d = new Date(`${day}T12:00:00`);
	d.setDate(d.getDate() + offset);
	return toLocalDate(d);
}

export function todayLocal(now: number = Date.now()): string {
	return toLocalDate(new Date(now));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Today", "Yday", or "Tue 3" for older days. */
export function dayLabel(day: string, today: string): string {
	if (day === today) return "Today";
	if (day === shiftDate(today, -1)) return "Yday";
	const d = new Date(`${day}T12:00:00`);
	return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

/** Compact age: "now", "5m", "2h", "3d". */
export function formatAge(ms: number): string {
	if (ms < 60_000) return "now";
	const min = Math.floor(ms / 60_000);
	if (min < 60) return `${min}m`;
	const h = Math.floor(min / 60);
	if (h < 48) return `${h}h`;
	return `${Math.floor(h / 24)}d`;
}

/** "2h 15m" / "45m" for a duration in seconds. */
export function formatDuration(seconds: number): string {
	const min = Math.round(seconds / 60);
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m}m`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
