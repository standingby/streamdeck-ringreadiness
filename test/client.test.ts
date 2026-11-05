import { describe, expect, it } from "vitest";

import type { TokenProvider } from "../src/oura/auth";
import { OuraClient } from "../src/oura/client";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function fakeTokens() {
	const t = { token: "t1", refreshes: 0 };
	const provider = {
		getToken: async () => t.token,
		refresh: async () => {
			t.refreshes++;
			t.token = "t2";
			return t.token;
		},
	} as unknown as TokenProvider;
	return { t, provider };
}

const noSleep = { sleep: async () => {} };

describe("OuraClient", () => {
	it("follows next_token pages and extends end_date by a day", async () => {
		const urls: URL[] = [];
		const fetchFn = (async (url: URL) => {
			urls.push(url);
			const page = url.searchParams.get("next_token");
			return json(page ? { data: [{ day: "b" }], next_token: null } : { data: [{ day: "a" }], next_token: "p2" });
		}) as unknown as typeof fetch;
		const client = new OuraClient(fakeTokens().provider, { fetchFn, ...noSleep });
		const bundle = await client.daily("2026-11-01", "2026-11-05");
		expect(bundle.readiness.map((d) => d.day)).toEqual(["a", "b"]);
		expect(urls[0]!.searchParams.get("end_date")).toBe("2026-11-06");
	});

	it("refreshes once on 401 and retries with the new token", async () => {
		const { t, provider } = fakeTokens();
		const seen: string[] = [];
		const fetchFn = (async (_url: URL, init: RequestInit) => {
			const auth = (init.headers as Record<string, string>).Authorization!;
			seen.push(auth);
			return auth === "Bearer t1" ? json({}, 401) : json({ data: [{ bpm: 60, source: "awake", timestamp: "2026-11-05T09:00:00Z" }] });
		}) as unknown as typeof fetch;
		const client = new OuraClient(provider, { fetchFn, ...noSleep });
		const hr = await client.latestHeartRate();
		expect(hr?.bpm).toBe(60);
		expect(t.refreshes).toBe(1);
		expect(seen).toEqual(["Bearer t1", "Bearer t2"]);
	});

	it("gives up with reauth after a second 401", async () => {
		const fetchFn = (async () => json({}, 401)) as unknown as typeof fetch;
		const client = new OuraClient(fakeTokens().provider, { fetchFn, ...noSleep });
		await expect(client.latestHeartRate()).rejects.toMatchObject({ code: "reauth" });
	});

	it("honours Retry-After on 429 and reports limit when it persists", async () => {
		const waits: number[] = [];
		const fetchFn = (async () => json({}, 429, { "retry-after": "2" })) as unknown as typeof fetch;
		const client = new OuraClient(fakeTokens().provider, { fetchFn, sleep: async (ms) => void waits.push(ms) });
		await expect(client.latestHeartRate()).rejects.toMatchObject({ code: "limit" });
		expect(waits).toEqual([2000, 2000, 2000]);
	});

	it("reports offline when the network fails", async () => {
		const fetchFn = (async () => {
			throw new TypeError("fetch failed");
		}) as unknown as typeof fetch;
		const client = new OuraClient(fakeTokens().provider, { fetchFn, ...noSleep });
		await expect(client.latestHeartRate()).rejects.toMatchObject({ code: "offline" });
	});

	it("picks the latest heart-rate sample regardless of order", async () => {
		const fetchFn = (async () =>
			json({
				data: [
					{ bpm: 70, source: "awake", timestamp: "2026-11-05T09:30:00Z" },
					{ bpm: 55, source: "awake", timestamp: "2026-11-05T08:00:00Z" },
				],
			})) as unknown as typeof fetch;
		const client = new OuraClient(fakeTokens().provider, { fetchFn, ...noSleep });
		expect((await client.latestHeartRate())?.bpm).toBe(70);
	});
});
