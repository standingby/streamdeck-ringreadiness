import type { DailyBundle, SleepDoc } from "../oura/client";
import type { ErrorCode } from "../oura/errors";
import { dayLabel, formatAge, formatDuration, shiftDate } from "../util/dates";

export const METRICS = ["readiness", "sleep", "activity", "steps", "stress", "hrv", "rhr", "hr"] as const;
export type MetricId = (typeof METRICS)[number];

export const METRIC_LABELS: Record<MetricId, { label: string; short: string; unit: string }> = {
	readiness: { label: "Readiness", short: "READY", unit: "" },
	sleep: { label: "Sleep", short: "SLEEP", unit: "" },
	activity: { label: "Activity", short: "ACTIVITY", unit: "" },
	steps: { label: "Steps", short: "STEPS", unit: "" },
	stress: { label: "Stress", short: "STRESS", unit: "" },
	hrv: { label: "HRV", short: "HRV", unit: "ms" },
	rhr: { label: "Resting HR", short: "RHR", unit: "bpm" },
	hr: { label: "Heart rate", short: "HR", unit: "bpm" },
};

/** Metrics that have one value per day (everything except live heart rate). */
export const DAILY_METRICS = METRICS.filter((m) => m !== "hr");

/** The metric after `current` in `order`, wrapping around; unknown values start at the first. */
export function nextMetric(current: MetricId, order: readonly MetricId[] = METRICS): MetricId {
	const i = order.indexOf(current);
	return order[(i + 1) % order.length]!;
}

export function isMetric(x: unknown): x is MetricId {
	return typeof x === "string" && (METRICS as readonly string[]).includes(x);
}

/** Provider-agnostic per-day values. Missing = not available for that day. */
export interface DayRecord {
	readiness?: number;
	sleep?: number;
	activity?: number;
	steps?: number;
	stressHigh?: number;
	stressSummary?: "restored" | "normal" | "stressful";
	hrv?: number;
	rhr?: number;
}

export interface DataState {
	days: Record<string, DayRecord>;
	dailyFetchedAt?: number;
	hr?: { bpm: number; at: number };
	hrFetchedAt?: number;
	dailyError?: ErrorCode;
	hrError?: ErrorCode;
}

export type Tone = "optimal" | "good" | "attention" | "neutral";

export interface MetricSettings {
	stepGoal: number;
}

export const DEFAULT_SETTINGS: MetricSettings = { stepGoal: 8000 };

export interface MetricView {
	metric: MetricId;
	label: string;
	short: string;
	/** The day the value belongs to (may be earlier than requested when falling back). */
	day?: string;
	value?: number;
	text: string;
	unit: string;
	tone: Tone;
	/** 0..1 for ring/bar fill, when the metric has a natural scale. */
	fraction?: number;
	dim: boolean;
	/** "Yday" / "Tue 3" when showing an earlier day's value. */
	note?: string;
	badge?: ErrorCode;
	age?: string;
	trend?: "up" | "down" | "flat";
}

/** Fold the raw Oura collections into one record per day. */
export function bundleToDays(bundle: DailyBundle): Record<string, DayRecord> {
	const days: Record<string, DayRecord> = {};
	const at = (day: string) => (days[day] ??= {});

	for (const d of bundle.readiness) if (d.score != null) at(d.day).readiness = d.score;
	for (const d of bundle.sleepScore) if (d.score != null) at(d.day).sleep = d.score;
	for (const d of bundle.activity) {
		if (d.score != null) at(d.day).activity = d.score;
		if (d.steps != null) at(d.day).steps = d.steps;
	}
	for (const d of bundle.stress) {
		if (d.stress_high != null) at(d.day).stressHigh = d.stress_high;
		if (d.day_summary) at(d.day).stressSummary = d.day_summary;
	}

	// HRV and resting HR come from the main sleep of the day only.
	const mainSleep = new Map<string, SleepDoc>();
	for (const s of bundle.sleep) {
		if (s.type !== "long_sleep") continue;
		const prev = mainSleep.get(s.day);
		if (!prev || (s.total_sleep_duration ?? 0) > (prev.total_sleep_duration ?? 0)) mainSleep.set(s.day, s);
	}
	for (const [day, s] of mainSleep) {
		if (s.average_hrv != null) at(day).hrv = s.average_hrv;
		if (s.lowest_heart_rate != null) at(day).rhr = s.lowest_heart_rate;
	}
	return days;
}

/** Numeric value of a daily metric for a day record. */
export function rawValue(rec: DayRecord | undefined, metric: MetricId): number | undefined {
	if (!rec) return undefined;
	switch (metric) {
		case "readiness":
		case "sleep":
		case "activity":
		case "steps":
		case "hrv":
		case "rhr":
			return rec[metric];
		case "stress":
			return rec.stressHigh;
		case "hr":
			return undefined;
	}
}

export function scoreTone(score: number): Tone {
	if (score >= 85) return "optimal";
	if (score >= 70) return "good";
	return "attention";
}

export function toneFor(metric: MetricId, value: number, rec: DayRecord | undefined, settings: MetricSettings): Tone {
	switch (metric) {
		case "readiness":
		case "sleep":
		case "activity":
			return scoreTone(value);
		case "steps": {
			const pct = value / Math.max(1, settings.stepGoal);
			return pct >= 1 ? "optimal" : pct >= 0.7 ? "good" : "attention";
		}
		case "stress":
			return rec?.stressSummary === "restored"
				? "optimal"
				: rec?.stressSummary === "normal"
					? "good"
					: rec?.stressSummary === "stressful"
						? "attention"
						: "neutral";
		default:
			return "neutral";
	}
}

export function formatValue(metric: MetricId, value: number): string {
	if (metric === "stress") return formatDuration(value);
	if (metric === "steps") return value >= 10_000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString("en-US");
	return String(Math.round(value));
}

function fractionFor(metric: MetricId, value: number, settings: MetricSettings): number | undefined {
	if (metric === "readiness" || metric === "sleep" || metric === "activity") return clamp01(value / 100);
	if (metric === "steps") return clamp01(value / Math.max(1, settings.stepGoal));
	return undefined;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function median(xs: number[]): number | undefined {
	if (xs.length === 0) return undefined;
	const s = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1]! + s[mid]!) / 2;
}

/** Direction of `value` against the median of the 30 days before `day`. */
export function trendFor(state: DataState, metric: MetricId, day: string, value: number): MetricView["trend"] {
	const past: number[] = [];
	for (let i = 1; i <= 30; i++) {
		const v = rawValue(state.days[shiftDate(day, -i)], metric);
		if (v !== undefined) past.push(v);
	}
	if (past.length < 5) return undefined;
	const m = median(past)!;
	if (Math.abs(value - m) <= m * 0.05) return "flat";
	return value > m ? "up" : "down";
}

const FALLBACK_DAYS = 3;

/** Everything a renderer needs to draw one metric for one day. */
export function metricView(
	state: DataState,
	metric: MetricId,
	day: string,
	today: string,
	now: number,
	settings: MetricSettings = DEFAULT_SETTINGS,
): MetricView {
	const { label, short, unit } = METRIC_LABELS[metric];

	if (metric === "hr") {
		const hr = state.hr;
		return {
			metric,
			label,
			short,
			unit,
			value: hr?.bpm,
			text: hr ? String(hr.bpm) : "—",
			tone: "neutral",
			dim: !hr || !!state.hrError,
			badge: state.hrError,
			age: hr ? formatAge(now - hr.at) : undefined,
		};
	}

	let shownDay = day;
	let value = rawValue(state.days[day], metric);
	for (let i = 1; value === undefined && i <= FALLBACK_DAYS; i++) {
		const d = shiftDate(day, -i);
		const v = rawValue(state.days[d], metric);
		if (v !== undefined) {
			shownDay = d;
			value = v;
		}
	}

	const age = state.dailyFetchedAt !== undefined ? formatAge(now - state.dailyFetchedAt) : undefined;
	if (value === undefined) {
		return { metric, label, short, unit, text: "—", tone: "neutral", dim: true, badge: state.dailyError, age };
	}

	const rec = state.days[shownDay];
	const fellBack = shownDay !== day;
	return {
		metric,
		label,
		short,
		unit,
		day: shownDay,
		value,
		text: formatValue(metric, value),
		tone: toneFor(metric, value, rec, settings),
		fraction: fractionFor(metric, value, settings),
		dim: fellBack || !!state.dailyError,
		note: fellBack ? dayLabel(shownDay, today) : undefined,
		badge: state.dailyError,
		age,
		trend: metric === "hrv" || metric === "rhr" ? trendFor(state, metric, shownDay, value) : undefined,
	};
}

export interface SeriesPoint {
	day: string;
	value?: number;
	tone: Tone;
	fraction?: number;
}

/** `count` days ending at `endDay`, oldest first, without fallback. */
export function series(
	state: DataState,
	metric: MetricId,
	endDay: string,
	count: number,
	settings: MetricSettings = DEFAULT_SETTINGS,
): SeriesPoint[] {
	const out: SeriesPoint[] = [];
	for (let i = count - 1; i >= 0; i--) {
		const day = shiftDate(endDay, -i);
		const rec = state.days[day];
		const value = rawValue(rec, metric);
		out.push(
			value === undefined
				? { day, tone: "neutral" }
				: { day, value, tone: toneFor(metric, value, rec, settings), fraction: fractionFor(metric, value, settings) },
		);
	}
	return out;
}
