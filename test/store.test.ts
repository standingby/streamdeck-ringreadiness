import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DataStore, FULL_EVERY, HR_EVERY, planFetch, RECENT_EVERY } from "../src/data/store";
import type { OuraClient } from "../src/oura/client";
import { OuraError } from "../src/oura/errors";
import { syntheticBundle } from "./fixtures/bundle";

describe("planFetch", () => {
	const vis = { any: true, hr: true };

	it("does nothing while no action is visible", () => {
		expect(planFetch(0, {}, { any: false, hr: false })).toEqual({ hr: false });
	});

	it("starts with a full fetch and heart rate", () => {
		expect(planFetch(0, {}, vis)).toEqual({ daily: "full", hr: true });
	});

	it("fetches recent days every 15 min and the full window daily", () => {
		const s = { lastFullAt: 0, lastRecentAt: 0, lastHrAt: 0 };
		expect(planFetch(RECENT_EVERY - 1, s, vis).daily).toBeUndefined();
		expect(planFetch(RECENT_EVERY, s, vis).daily).toBe("recent");
		expect(planFetch(FULL_EVERY, s, vis).daily).toBe("full");
	});

	it("polls heart rate every 5 min only when it is visible", () => {
		const s = { lastFullAt: 0, lastRecentAt: 0, lastHrAt: 0 };
		expect(planFetch(HR_EVERY, s, vis).hr).toBe(true);
		expect(planFetch(HR_EVERY - 1, s, vis).hr).toBe(false);
		expect(planFetch(HR_EVERY, s, { any: true, hr: false }).hr).toBe(false);
	});
});

function cacheFile(): string {
	return path.join(mkdtempSync(path.join(os.tmpdir(), "oura-cache-")), "cache.json");
}

describe("DataStore", () => {
	const now = () => new Date("2026-11-05T10:00:00").getTime();

	it("loads data, caches it and restores it after restart", async () => {
		const file = cacheFile();
		let calls = 0;
		const client = {
			daily: async () => {
				calls++;
				return syntheticBundle();
			},
			latestHeartRate: async () => ({ bpm: 61, source: "awake", timestamp: "2026-11-05T09:50:00Z" }),
		} as unknown as OuraClient;
		const store = new DataStore(client, file, now);
		await store.init();
		store.dispose();
		let notified = 0;
		store.subscribe(() => notified++);
		expect(await store.refresh()).toBe(true);
		expect(calls).toBe(1);
		expect(notified).toBeGreaterThan(0);
		expect(store.state.days["2026-11-05"]?.sleep).toBe(91);

		const again = new DataStore(client, file, now);
		await again.init();
		again.dispose();
		expect(again.state.days["2026-11-05"]?.sleep).toBe(91);
		expect(again.state.dailyFetchedAt).toBe(now());
	});

	it("keeps old values and records the error code on failure", async () => {
		const file = cacheFile();
		let fail = false;
		const client = {
			daily: async () => {
				if (fail) throw new OuraError("nope", "limit", 429);
				return syntheticBundle();
			},
		} as unknown as OuraClient;
		const store = new DataStore(client, file, now);
		await store.init();
		store.dispose();
		await store.refresh();
		fail = true;
		expect(await store.refresh()).toBe(false);
		expect(store.state.dailyError).toBe("limit");
		expect(store.state.days["2026-11-05"]?.sleep).toBe(91);
	});

	it("clearData wipes memory and the cache file", async () => {
		const file = cacheFile();
		const client = { daily: async () => syntheticBundle() } as unknown as OuraClient;
		const store = new DataStore(client, file, now);
		await store.init();
		store.dispose();
		await store.refresh();
		expect(existsSync(file)).toBe(true);
		await store.clearData();
		expect(store.state.days).toEqual({});
		expect(existsSync(file)).toBe(false);
	});

	it("shares one in-flight daily fetch between callers", async () => {
		let calls = 0;
		const client = {
			daily: async () => {
				calls++;
				await new Promise((r) => setTimeout(r, 10));
				return syntheticBundle();
			},
		} as unknown as OuraClient;
		const store = new DataStore(client, cacheFile(), now);
		await store.init();
		store.dispose();
		await Promise.all([store.refresh(), store.refresh(), store.refresh()]);
		expect(calls).toBe(1);
	});
});
