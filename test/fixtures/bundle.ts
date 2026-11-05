import type { DailyBundle } from "../../src/oura/client";

/** Synthetic data in the shape of the Oura API v2. Not real health data. */
export function syntheticBundle(): DailyBundle {
	return {
		readiness: [
			{ day: "2026-11-03", score: 88 },
			{ day: "2026-11-04", score: 74 },
		],
		sleepScore: [
			{ day: "2026-11-04", score: 65 },
			{ day: "2026-11-05", score: 91 },
		],
		activity: [
			{ day: "2026-11-04", score: 80, steps: 9120 },
			{ day: "2026-11-05", score: null, steps: 2300 },
		],
		stress: [
			{ day: "2026-11-04", stress_high: 8100, recovery_high: 3600, day_summary: "stressful" },
			{ day: "2026-11-05", stress_high: 900, recovery_high: 0, day_summary: null },
		],
		sleep: [
			{ day: "2026-11-05", type: "late_nap", average_hrv: 80, lowest_heart_rate: 40, total_sleep_duration: 1800 },
			{ day: "2026-11-05", type: "long_sleep", average_hrv: 42, lowest_heart_rate: 52, total_sleep_duration: 25000 },
			{ day: "2026-11-05", type: "long_sleep", average_hrv: 30, lowest_heart_rate: 60, total_sleep_duration: 4000 },
			{ day: "2026-11-04", type: "long_sleep", average_hrv: null, lowest_heart_rate: 55, total_sleep_duration: 26000 },
		],
	};
}
