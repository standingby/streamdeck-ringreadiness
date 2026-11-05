import path from "node:path";

import type { OuraClient } from "../oura/client";
import { toErrorCode } from "../oura/errors";
import { shiftDate, todayLocal } from "../util/dates";
import { dataDir, readJson, writeJsonAtomic } from "../util/files";
import { bundleToDays, type DataState } from "./metrics";

export const FULL_DAYS = 31;
export const RECENT_DAYS = 3;
export const RECENT_EVERY = 15 * 60_000;
export const FULL_EVERY = 24 * 3_600_000;
export const HR_EVERY = 5 * 60_000;
const TICK_MS = 30_000;

export interface Schedule {
	lastFullAt?: number;
	lastRecentAt?: number;
	lastHrAt?: number;
}

export interface Visibility {
	any: boolean;
	hr: boolean;
}

export interface FetchPlan {
	daily?: "full" | "recent";
	hr: boolean;
}

/** Decide what is due. Times are attempt times, so failures retry at the normal cadence. */
export function planFetch(now: number, s: Schedule, v: Visibility): FetchPlan {
	if (!v.any) return { hr: false };
	let daily: FetchPlan["daily"];
	if (s.lastFullAt === undefined || now - s.lastFullAt >= FULL_EVERY) daily = "full";
	else if (s.lastRecentAt === undefined || now - s.lastRecentAt >= RECENT_EVERY) daily = "recent";
	const hr = v.hr && (s.lastHrAt === undefined || now - s.lastHrAt >= HR_EVERY);
	return { daily, hr };
}

/** Keep only the last `keep` days so the cache does not grow forever. */
function prune(days: DataState["days"], today: string, keep: number): DataState["days"] {
	const oldest = shiftDate(today, -keep);
	return Object.fromEntries(Object.entries(days).filter(([d]) => d >= oldest));
}

interface CacheFile {
	version: 1;
	state: DataState;
}

/**
 * One shared loader for every action: polls only while something is visible, caches to disk so
 * keys show the last values right after Stream Deck starts, and notifies subscribers on change.
 */
export class DataStore {
	state: DataState = { days: {} };
	private sched: Schedule = {};
	private readonly visible = new Map<string, boolean>();
	private readonly listeners = new Set<() => void>();
	private dailyInFlight: Promise<boolean> | undefined;
	private hrInFlight: Promise<boolean> | undefined;
	private timer: NodeJS.Timeout | undefined;

	constructor(
		private readonly client: OuraClient,
		private readonly cacheFile: string = path.join(dataDir(), "cache.json"),
		private readonly now: () => number = Date.now,
		private readonly log: (msg: string) => void = () => {},
	) {}

	async init(): Promise<void> {
		const cached = await readJson<CacheFile>(this.cacheFile);
		if (cached?.version === 1 && cached.state?.days) {
			this.state = { ...cached.state, dailyError: undefined, hrError: undefined };
		}
		this.timer = setInterval(() => void this.tick(), TICK_MS);
		this.timer.unref?.();
	}

	dispose(): void {
		clearInterval(this.timer);
	}

	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	setVisible(context: string, needsHr: boolean): void {
		this.visible.set(context, needsHr);
		void this.tick();
	}

	setHidden(context: string): void {
		this.visible.delete(context);
	}

	visibility(): Visibility {
		return { any: this.visible.size > 0, hr: [...this.visible.values()].some(Boolean) };
	}

	async tick(): Promise<void> {
		const plan = planFetch(this.now(), this.sched, this.visibility());
		const jobs: Promise<boolean>[] = [];
		if (plan.daily) jobs.push(this.fetchDaily(plan.daily));
		if (plan.hr) jobs.push(this.fetchHr());
		await Promise.all(jobs);
	}

	/** Manual refresh from a key/dial press. Resolves false when anything failed. */
	async refresh(): Promise<boolean> {
		const jobs = [this.fetchDaily(this.sched.lastFullAt === undefined ? "full" : "recent")];
		if (this.visibility().hr) jobs.push(this.fetchHr());
		const results = await Promise.all(jobs);
		return results.every(Boolean);
	}

	/** After connect/disconnect: forget schedule so the next tick fetches everything. */
	resetSchedule(): void {
		this.sched = {};
		this.state = { ...this.state, dailyError: undefined, hrError: undefined };
		this.emit();
		void this.tick();
	}

	private fetchDaily(kind: "full" | "recent"): Promise<boolean> {
		this.dailyInFlight ??= this.doFetchDaily(kind).finally(() => {
			this.dailyInFlight = undefined;
		});
		return this.dailyInFlight;
	}

	private async doFetchDaily(kind: "full" | "recent"): Promise<boolean> {
		const now = this.now();
		if (kind === "full") this.sched.lastFullAt = now;
		this.sched.lastRecentAt = now;
		const today = todayLocal(now);
		const start = shiftDate(today, -(kind === "full" ? FULL_DAYS : RECENT_DAYS - 1));
		try {
			const bundle = await this.client.daily(start, today);
			const fresh = bundleToDays(bundle);
			// Replace the fetched window wholesale so deleted/changed days do not linger.
			const days = Object.fromEntries(Object.entries(this.state.days).filter(([d]) => d < start || d > today));
			this.state = {
				...this.state,
				days: prune({ ...days, ...fresh }, today, 62),
				dailyFetchedAt: this.now(),
				dailyError: undefined,
			};
			this.emit();
			await this.save();
			return true;
		} catch (err) {
			this.log(`daily fetch failed: ${String(err)}`);
			this.state = { ...this.state, dailyError: toErrorCode(err) };
			this.emit();
			return false;
		}
	}

	private fetchHr(): Promise<boolean> {
		this.hrInFlight ??= this.doFetchHr().finally(() => {
			this.hrInFlight = undefined;
		});
		return this.hrInFlight;
	}

	private async doFetchHr(): Promise<boolean> {
		this.sched.lastHrAt = this.now();
		try {
			const sample = await this.client.latestHeartRate(24, this.now());
			this.state = {
				...this.state,
				hr: sample ? { bpm: sample.bpm, at: Date.parse(sample.timestamp) } : this.state.hr,
				hrFetchedAt: this.now(),
				hrError: undefined,
			};
			this.emit();
			await this.save();
			return true;
		} catch (err) {
			this.log(`heart rate fetch failed: ${String(err)}`);
			this.state = { ...this.state, hrError: toErrorCode(err) };
			this.emit();
			return false;
		}
	}

	private async save(): Promise<void> {
		try {
			const { dailyError: _d, hrError: _h, ...state } = this.state;
			await writeJsonAtomic(this.cacheFile, { version: 1, state } satisfies CacheFile);
		} catch (err) {
			this.log(`cache write failed: ${String(err)}`);
		}
	}

	private emit(): void {
		for (const fn of this.listeners) {
			try {
				fn();
			} catch (err) {
				this.log(`listener failed: ${String(err)}`);
			}
		}
	}
}
