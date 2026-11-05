import path from "node:path";

import { dataDir, readJson, writeJsonAtomic } from "../util/files";
import { OuraError } from "./errors";

export const TOKEN_URL = "https://api.ouraring.com/oauth/token";
export const AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
export const SCOPES = "daily heartrate personal";
export const CALLBACK_PORT = 51789;
export const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

export interface AuthData {
	clientId?: string;
	clientSecret?: string;
	accessToken?: string;
	refreshToken?: string;
	/** Epoch ms when the access token expires. */
	expiresAt?: number;
	pat?: string;
}

export type AuthMethod = "oauth" | "pat" | "none";

/** What the property inspector may see: no secrets, only whether they exist. */
export interface AuthStatus {
	method: AuthMethod;
	clientId: string;
	hasClientSecret: boolean;
	hasPat: boolean;
}

export function authMethod(data: AuthData): AuthMethod {
	if (data.refreshToken || data.accessToken) return "oauth";
	if (data.pat) return "pat";
	return "none";
}

/** auth.json on disk. All writes go through `update` so they are serialised and atomic. */
export class AuthStore {
	private data: AuthData = {};
	private loaded = false;
	private queue: Promise<unknown> = Promise.resolve();

	constructor(readonly file: string = path.join(dataDir(), "auth.json")) {}

	async get(): Promise<AuthData> {
		if (!this.loaded) {
			this.data = (await readJson<AuthData>(this.file)) ?? {};
			this.loaded = true;
		}
		return this.data;
	}

	update(patch: Partial<AuthData>): Promise<AuthData> {
		const run = this.queue.then(async () => {
			const next: AuthData = { ...(await this.get()), ...patch };
			for (const key of Object.keys(next) as (keyof AuthData)[]) {
				if (next[key] === undefined || next[key] === "") delete next[key];
			}
			await writeJsonAtomic(this.file, next);
			this.data = next;
			return next;
		});
		this.queue = run.catch(() => undefined);
		return run;
	}

	async status(): Promise<AuthStatus> {
		const d = await this.get();
		return {
			method: authMethod(d),
			clientId: d.clientId ?? "",
			hasClientSecret: !!d.clientSecret,
			hasPat: !!d.pat,
		};
	}
}

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
}

export type FetchFn = typeof fetch;

/**
 * Hands out a valid bearer token. OAuth is preferred; the PAT is used only when no OAuth tokens
 * exist. Refreshes are single-flight because Oura refresh tokens work once: two parallel
 * refreshes would burn the token and force a new login.
 */
export class TokenProvider {
	private refreshing: Promise<string> | undefined;

	constructor(
		private readonly store: AuthStore,
		private readonly fetchFn: FetchFn = fetch,
		private readonly now: () => number = Date.now,
	) {}

	async getToken(): Promise<string> {
		const d = await this.store.get();
		const method = authMethod(d);
		if (method === "pat") return d.pat!;
		if (method === "none") throw new OuraError("Not connected to Oura", "connect");
		if (d.accessToken && (d.expiresAt === undefined || d.expiresAt - 60_000 > this.now())) {
			return d.accessToken;
		}
		return this.refresh();
	}

	/** Force a refresh, e.g. after a 401 on a token we believed valid. */
	refresh(): Promise<string> {
		this.refreshing ??= this.doRefresh().finally(() => {
			this.refreshing = undefined;
		});
		return this.refreshing;
	}

	private async doRefresh(): Promise<string> {
		const d = await this.store.get();
		if (!d.refreshToken) {
			if (d.pat) return d.pat;
			throw new OuraError("No refresh token; reconnect Oura", "reauth");
		}
		if (!d.clientId || !d.clientSecret) {
			throw new OuraError("Client id/secret missing; reconnect Oura", "reauth");
		}
		const tokens = await postToken(this.fetchFn, {
			grant_type: "refresh_token",
			refresh_token: d.refreshToken,
			client_id: d.clientId,
			client_secret: d.clientSecret,
		});
		// Persist before returning: the old refresh token is already spent.
		await this.store.update(tokensToAuth(tokens, this.now()));
		return tokens.access_token;
	}

	async exchangeCode(code: string): Promise<void> {
		const d = await this.store.get();
		if (!d.clientId || !d.clientSecret) throw new OuraError("Client id/secret missing", "connect");
		const tokens = await postToken(this.fetchFn, {
			grant_type: "authorization_code",
			code,
			redirect_uri: REDIRECT_URI,
			client_id: d.clientId,
			client_secret: d.clientSecret,
		});
		await this.store.update(tokensToAuth(tokens, this.now()));
	}
}

function tokensToAuth(t: TokenResponse, now: number): Partial<AuthData> {
	return {
		accessToken: t.access_token,
		refreshToken: t.refresh_token,
		expiresAt: t.expires_in ? now + t.expires_in * 1000 : undefined,
	};
}

async function postToken(fetchFn: FetchFn, body: Record<string, string>): Promise<TokenResponse> {
	let res: Response;
	try {
		res = await fetchFn(TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
			body: new URLSearchParams(body).toString(),
			signal: AbortSignal.timeout(20_000),
		});
	} catch (err) {
		throw new OuraError(`Token request failed: ${String(err)}`, "offline");
	}
	if (res.status === 429) throw new OuraError("Token endpoint rate limited", "limit", 429);
	if (res.status >= 500) throw new OuraError(`Token endpoint error ${res.status}`, "offline", res.status);
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new OuraError(`Token request rejected (${res.status}) ${text.slice(0, 200)}`, "reauth", res.status);
	}
	const json = (await res.json()) as TokenResponse;
	if (!json.access_token) throw new OuraError("Token response had no access_token", "reauth");
	return json;
}
