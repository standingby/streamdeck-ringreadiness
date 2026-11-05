import streamDeck from "@elgato/streamdeck";

import { DataStore } from "./data/store";
import { AuthStore, REDIRECT_URI, TokenProvider } from "./oura/auth";
import { OuraClient } from "./oura/client";
import { waitForCode } from "./oura/login";
import { migrateLegacyDataDir } from "./util/files";

const log = streamDeck.logger.createScope("oura");

/** One-time copy of files from the pre-release data folder; everything reads after it. */
export const dataReady = migrateLegacyDataDir()
	.then((copied) => copied && log.info("migrated data from the legacy folder"))
	.catch((err) => log.warn(`legacy data migration failed: ${String(err)}`));

export const auth = new AuthStore(undefined, dataReady);
export const tokens = new TokenProvider(auth);
export const client = new OuraClient(tokens);
export const store = new DataStore(client, undefined, Date.now, (m) => log.warn(m));

/** Messages the property inspector sends to the plugin. */
export type PiMessage =
	| { type: "status" }
	| { type: "connect"; clientId?: string; clientSecret?: string }
	| { type: "disconnect" }
	| { type: "refresh" };

let loginInFlight = false;

async function pushStatus(extra: Record<string, string> = {}): Promise<void> {
	const s = await auth.status();
	await streamDeck.ui.sendToPropertyInspector({
		type: "status",
		method: s.method,
		clientId: s.clientId,
		hasClientSecret: s.hasClientSecret,
		redirectUri: REDIRECT_URI,
		loginInFlight,
		...extra,
	});
}

export async function isConnected(): Promise<boolean> {
	return (await auth.status()).method !== "none";
}

/** Start the browser login; client id/secret are saved first so a refresh can use them later. */
export async function startLogin(clientId?: string, clientSecret?: string): Promise<void> {
	if (clientId !== undefined || clientSecret !== undefined) {
		const patch: { clientId?: string; clientSecret?: string } = {};
		if (clientId?.trim()) patch.clientId = clientId.trim();
		if (clientSecret?.trim()) patch.clientSecret = clientSecret.trim();
		await auth.update(patch);
	}
	const d = await auth.get();
	if (!d.clientId || !d.clientSecret) {
		await pushStatus({ message: "Enter client ID and client secret first." });
		return;
	}
	loginInFlight = true;
	await pushStatus({ message: "Finish the login in your browser…" });
	try {
		const code = await waitForCode(d.clientId, (url) => streamDeck.system.openUrl(url));
		await tokens.exchangeCode(code);
		log.info("Oura connected via OAuth");
		loginInFlight = false;
		store.resetSchedule();
		await pushStatus({ message: "Connected." });
	} catch (err) {
		loginInFlight = false;
		log.error(`login failed: ${String(err)}`);
		await pushStatus({ message: `Login failed: ${err instanceof Error ? err.message : String(err)}` });
	}
	onAuthChanged();
}

export async function handlePiMessage(msg: PiMessage): Promise<void> {
	switch (msg.type) {
		case "status":
			await pushStatus();
			return;
		case "connect":
			if (loginInFlight) {
				await pushStatus({ message: "Login already in progress." });
				return;
			}
			void startLogin(msg.clientId, msg.clientSecret);
			return;
		case "disconnect":
			// Oura requires user data to be deletable on request: drop tokens and every cached value.
			await auth.update({ accessToken: undefined, refreshToken: undefined, expiresAt: undefined });
			await store.clearData();
			onAuthChanged();
			await pushStatus({ message: "Disconnected. Tokens and cached data deleted." });
			return;
		case "refresh":
			await store.refresh();
			return;
	}
}

const authListeners = new Set<() => void>();
export function onAuthChange(fn: () => void): void {
	authListeners.add(fn);
}
function onAuthChanged(): void {
	for (const fn of authListeners) fn();
}

/** Press-and-hold threshold: shorter is a press (next metric), longer is a hold (refresh). */
export const LONG_PRESS_MS = 600;
