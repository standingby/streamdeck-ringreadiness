import type { FetchFn, TokenProvider } from "./auth";
import { USER_AGENT } from "../version";
import { OuraError } from "./errors";

const BASE_URL = "https://api.ouraring.com/v2/usercollection";

export interface DailyScoreDoc {
	day: string;
	score: number | null;
}
export interface DailyActivityDoc extends DailyScoreDoc {
	steps?: number | null;
}
export interface DailyStressDoc {
	day: string;
	stress_high: number | null;
	recovery_high: number | null;
	day_summary: "restored" | "normal" | "stressful" | null;
}
export interface SleepDoc {
	day: string;
	type: "deleted" | "sleep" | "long_sleep" | "late_nap" | "rest" | string;
	average_hrv?: number | null;
	lowest_heart_rate?: number | null;
	total_sleep_duration?: number | null;
}
export interface HeartRateSample {
	bpm: number;
	source: string;
	timestamp: string;
}

export interface DailyBundle {
	readiness: DailyScoreDoc[];
	sleepScore: DailyScoreDoc[];
	activity: DailyActivityDoc[];
	stress: DailyStressDoc[];
	sleep: SleepDoc[];
}

export interface ClientOptions {
	fetchFn?: FetchFn;
	sleep?: (ms: number) => Promise<void>;
	timeoutMs?: number;
}

/** Minimal Oura API v2 client: bearer auth, pagination, retries on 429/5xx, one 401 refresh. */
export class OuraClient {
	private readonly fetchFn: FetchFn;
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly timeoutMs: number;

	constructor(
		private readonly tokens: TokenProvider,
		opts: ClientOptions = {},
	) {
		this.fetchFn = opts.fetchFn ?? fetch;
		this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
		this.timeoutMs = opts.timeoutMs ?? 20_000;
	}

	/** Daily collections for [startDate, endDate], both local dates, inclusive. */
	async daily(startDate: string, endDate: string): Promise<DailyBundle> {
		// end_date is treated as exclusive by some daily endpoints; ask one day further.
		const end = nextDay(endDate);
		const range = { start_date: startDate, end_date: end };
		const [readiness, sleepScore, activity, stress, sleep] = await Promise.all([
			this.list<DailyScoreDoc>("daily_readiness", range),
			this.list<DailyScoreDoc>("daily_sleep", range),
			this.list<DailyActivityDoc>("daily_activity", range),
			this.list<DailyStressDoc>("daily_stress", range),
			this.list<SleepDoc>("sleep", range),
		]);
		return { readiness, sleepScore, activity, stress, sleep };
	}

	/** The most recent heart-rate sample in the last `hours`, if any. */
	async latestHeartRate(hours = 24, now = Date.now()): Promise<HeartRateSample | undefined> {
		const samples = await this.list<HeartRateSample>("heartrate", {
			start_datetime: new Date(now - hours * 3_600_000).toISOString(),
			end_datetime: new Date(now).toISOString(),
		});
		let latest: HeartRateSample | undefined;
		for (const s of samples) {
			if (!latest || Date.parse(s.timestamp) > Date.parse(latest.timestamp)) latest = s;
		}
		return latest;
	}

	private async list<T>(collection: string, params: Record<string, string>): Promise<T[]> {
		const out: T[] = [];
		let nextToken: string | undefined;
		for (let page = 0; page < 50; page++) {
			const query = nextToken ? { ...params, next_token: nextToken } : params;
			const json = (await this.request(collection, query)) as { data?: T[]; next_token?: string | null };
			out.push(...(json.data ?? []));
			if (!json.next_token) break;
			nextToken = json.next_token;
		}
		return out;
	}

	private async request(collection: string, params: Record<string, string>): Promise<unknown> {
		const url = new URL(`${BASE_URL}/${collection}`);
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

		let refreshed = false;
		const maxAttempts = 4;
		for (let attempt = 1; ; attempt++) {
			const token = await this.tokens.getToken();
			let res: Response;
			try {
				res = await this.fetchFn(url, {
					headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": USER_AGENT },
					signal: AbortSignal.timeout(this.timeoutMs),
				});
			} catch (err) {
				if (attempt < maxAttempts) {
					await this.sleep(500 * 2 ** (attempt - 1));
					continue;
				}
				throw new OuraError(`Cannot reach Oura: ${String(err)}`, "offline");
			}

			if (res.ok) return res.json();

			if (res.status === 401 && !refreshed) {
				refreshed = true;
				await this.tokens.refresh();
				continue;
			}
			if (res.status === 401 || res.status === 403) {
				throw new OuraError(`Oura rejected the token (${res.status})`, "reauth", res.status);
			}
			if (res.status === 429 || res.status >= 500) {
				if (attempt < maxAttempts) {
					const retryAfter = Number(res.headers.get("retry-after"));
					const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** (attempt - 1);
					await this.sleep(Math.min(wait, 60_000));
					continue;
				}
				throw new OuraError(`Oura ${res.status} on ${collection}`, res.status === 429 ? "limit" : "offline", res.status);
			}
			const body = await res.text().catch(() => "");
			throw new OuraError(`Oura ${res.status} on ${collection}: ${body.slice(0, 200)}`, "error", res.status);
		}
	}
}

function nextDay(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}
