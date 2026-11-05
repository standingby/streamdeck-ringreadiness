import { describe, expect, it } from "vitest";

import { bundleToDays, type DataState, metricView, series, toneFor } from "../src/data/metrics";
import { shiftDate } from "../src/util/dates";
import { syntheticBundle } from "./fixtures/bundle";

const TODAY = "2026-11-05";
const NOW = new Date("2026-11-05T10:00:00").getTime();

function state(extra: Partial<DataState> = {}): DataState {
	return { days: bundleToDays(syntheticBundle()), dailyFetchedAt: NOW - 5 * 60_000, ...extra };
}

describe("bundleToDays", () => {
	it("takes HRV and resting HR from the longest long_sleep only", () => {
		const days = bundleToDays(syntheticBundle());
		expect(days[TODAY]).toMatchObject({ hrv: 42, rhr: 52 });
		expect(days["2026-11-04"]?.hrv).toBeUndefined();
		expect(days["2026-11-04"]?.rhr).toBe(55);
	});

	it("skips null scores but keeps steps", () => {
		const days = bundleToDays(syntheticBundle());
		expect(days[TODAY]?.activity).toBeUndefined();
		expect(days[TODAY]?.steps).toBe(2300);
	});
});

describe("tones", () => {
	it("uses Oura score bands", () => {
		expect(toneFor("readiness", 85, undefined, { stepGoal: 8000 })).toBe("optimal");
		expect(toneFor("readiness", 84, undefined, { stepGoal: 8000 })).toBe("good");
		expect(toneFor("readiness", 70, undefined, { stepGoal: 8000 })).toBe("good");
		expect(toneFor("readiness", 69, undefined, { stepGoal: 8000 })).toBe("attention");
	});

	it("colours steps by goal and stress by Oura's day summary", () => {
		expect(toneFor("steps", 8000, undefined, { stepGoal: 8000 })).toBe("optimal");
		expect(toneFor("steps", 5600, undefined, { stepGoal: 8000 })).toBe("good");
		expect(toneFor("steps", 5000, undefined, { stepGoal: 8000 })).toBe("attention");
		expect(toneFor("stress", 100, { stressSummary: "restored" }, { stepGoal: 8000 })).toBe("optimal");
		expect(toneFor("stress", 100, {}, { stepGoal: 8000 })).toBe("neutral");
	});
});

describe("metricView", () => {
	it("shows today's value undimmed with data age", () => {
		const v = metricView(state(), "sleep", TODAY, TODAY, NOW);
		expect(v).toMatchObject({ text: "91", tone: "optimal", dim: false, age: "5m", fraction: 0.91 });
		expect(v.note).toBeUndefined();
	});

	it("falls back to yesterday dimmed with a Yday note when today has no value", () => {
		const v = metricView(state(), "readiness", TODAY, TODAY, NOW);
		expect(v).toMatchObject({ text: "74", day: "2026-11-04", dim: true, note: "Yday" });
	});

	it("shows a dash when nothing is available within 3 days", () => {
		const v = metricView(state(), "readiness", "2026-10-20", TODAY, NOW);
		expect(v).toMatchObject({ text: "—", dim: true });
	});

	it("keeps the last value but dims it and adds the error badge on failure", () => {
		const v = metricView(state({ dailyError: "offline" }), "sleep", TODAY, TODAY, NOW);
		expect(v).toMatchObject({ text: "91", dim: true, badge: "offline" });
	});

	it("formats stress as duration and steps with separators", () => {
		expect(metricView(state(), "stress", "2026-11-04", TODAY, NOW)).toMatchObject({ text: "2h 15m", tone: "attention" });
		expect(metricView(state(), "steps", "2026-11-04", TODAY, NOW, { stepGoal: 9000 })).toMatchObject({
			text: "9,120",
			tone: "optimal",
		});
	});

	it("uses the heart rate sample age, not the fetch age", () => {
		const s = state({ hr: { bpm: 63, at: NOW - 2 * 3_600_000 }, hrFetchedAt: NOW });
		expect(metricView(s, "hr", TODAY, TODAY, NOW)).toMatchObject({ text: "63", age: "2h", dim: false });
	});

	it("computes HRV trend against the 30-day median", () => {
		const days: DataState["days"] = {};
		for (let i = 1; i <= 10; i++) days[shiftDate(TODAY, -i)] = { hrv: 40 };
		days[TODAY] = { hrv: 50 };
		expect(metricView({ days }, "hrv", TODAY, TODAY, NOW).trend).toBe("up");
		days[TODAY] = { hrv: 41 };
		expect(metricView({ days }, "hrv", TODAY, TODAY, NOW).trend).toBe("flat");
		days[TODAY] = { hrv: 30 };
		expect(metricView({ days }, "hrv", TODAY, TODAY, NOW).trend).toBe("down");
	});
});

describe("series", () => {
	it("returns oldest-first points without fallback", () => {
		const pts = series(state(), "readiness", TODAY, 3);
		expect(pts.map((p) => p.day)).toEqual(["2026-11-03", "2026-11-04", TODAY]);
		expect(pts.map((p) => p.value)).toEqual([88, 74, undefined]);
	});
});
