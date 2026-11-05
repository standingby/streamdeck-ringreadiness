import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AuthStore, TokenProvider } from "../src/oura/auth";
import { OuraError } from "../src/oura/errors";
import { migrateLegacyDataDir } from "../src/util/files";

function tmpFile(): string {
	return path.join(mkdtempSync(path.join(os.tmpdir(), "oura-auth-")), "auth.json");
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("AuthStore", () => {
	it("writes atomically and drops empty fields", async () => {
		const file = tmpFile();
		const store = new AuthStore(file);
		await store.update({ clientId: "id", clientSecret: "s" });
		await store.update({ clientSecret: "" });
		expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ clientId: "id" });
		expect(await new AuthStore(file).get()).toEqual({ clientId: "id" });
	});

	it("reports status without secrets", async () => {
		const store = new AuthStore(tmpFile());
		await store.update({ clientId: "id", clientSecret: "s", refreshToken: "r" });
		expect(await store.status()).toEqual({ method: "oauth", clientId: "id", hasClientSecret: true });
	});
});

describe("TokenProvider", () => {
	it("throws a connect error when nothing is configured", async () => {
		const p = new TokenProvider(new AuthStore(tmpFile()));
		await expect(p.getToken()).rejects.toMatchObject({ code: "connect" });
	});

	it("treats a leftover personal access token as not connected", async () => {
		const file = tmpFile();
		writeFileSync(file, JSON.stringify({ pat: "legacy" }));
		await expect(new TokenProvider(new AuthStore(file)).getToken()).rejects.toMatchObject({ code: "connect" });
	});

	it("returns a still-valid access token without refreshing", async () => {
		const store = new AuthStore(tmpFile());
		await store.update({ accessToken: "a", refreshToken: "r", expiresAt: 10_000_000 });
		expect(await new TokenProvider(store, fetch, () => 0).getToken()).toBe("a");
	});

	it("refreshes once for concurrent callers and saves the new pair before returning", async () => {
		const file = tmpFile();
		const store = new AuthStore(file);
		await store.update({ clientId: "id", clientSecret: "s", accessToken: "old", refreshToken: "r1", expiresAt: 1000 });
		let calls = 0;
		const fakeFetch = (async (_url: string, init: RequestInit) => {
			calls++;
			expect((init.headers as Record<string, string>)["User-Agent"]).toContain("RingReadiness/");
			const body = new URLSearchParams(String(init.body));
			expect(body.get("grant_type")).toBe("refresh_token");
			expect(body.get("refresh_token")).toBe("r1");
			await new Promise((r) => setTimeout(r, 10));
			return json({ access_token: "new", refresh_token: "r2", expires_in: 86400 });
		}) as unknown as typeof fetch;
		const p = new TokenProvider(store, fakeFetch, () => 5000);
		const tokens = await Promise.all([p.getToken(), p.getToken(), p.getToken()]);
		expect(tokens).toEqual(["new", "new", "new"]);
		expect(calls).toBe(1);
		const saved = JSON.parse(readFileSync(file, "utf8"));
		expect(saved).toMatchObject({ accessToken: "new", refreshToken: "r2", expiresAt: 5000 + 86_400_000 });
	});

	it("maps a rejected refresh to reauth", async () => {
		const store = new AuthStore(tmpFile());
		await store.update({ clientId: "id", clientSecret: "s", refreshToken: "dead" });
		const fakeFetch = (async () => json({ error: "invalid_grant" }, 400)) as unknown as typeof fetch;
		const err = await new TokenProvider(store, fakeFetch).getToken().catch((e) => e);
		expect(err).toBeInstanceOf(OuraError);
		expect(err.code).toBe("reauth");
	});
});

describe("migrateLegacyDataDir", () => {
	it("copies auth and cache once, and never overwrites an existing login", async () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "oura-migrate-"));
		const legacy = path.join(root, "streamdeck-oura");
		const target = path.join(root, "ringreadiness");
		mkdirSync(legacy);
		writeFileSync(path.join(legacy, "auth.json"), JSON.stringify({ clientId: "old" }));
		writeFileSync(path.join(legacy, "cache.json"), "{}");
		expect(await migrateLegacyDataDir(target, legacy)).toBe(true);
		expect(JSON.parse(readFileSync(path.join(target, "auth.json"), "utf8"))).toEqual({ clientId: "old" });
		writeFileSync(path.join(legacy, "auth.json"), JSON.stringify({ clientId: "newer-legacy" }));
		expect(await migrateLegacyDataDir(target, legacy)).toBe(false);
		expect(JSON.parse(readFileSync(path.join(target, "auth.json"), "utf8"))).toEqual({ clientId: "old" });
	});

	it("does nothing when there is no legacy folder", async () => {
		const root = mkdtempSync(path.join(os.tmpdir(), "oura-migrate-"));
		expect(await migrateLegacyDataDir(path.join(root, "new"), path.join(root, "missing"))).toBe(false);
	});
});
