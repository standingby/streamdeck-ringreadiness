import { randomBytes } from "node:crypto";
import http from "node:http";

import { AUTHORIZE_URL, CALLBACK_PORT, REDIRECT_URI, SCOPES } from "./auth";

const TIMEOUT_MS = 5 * 60_000;

export function authorizeUrl(clientId: string, state: string): string {
	const url = new URL(AUTHORIZE_URL);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", clientId);
	url.searchParams.set("redirect_uri", REDIRECT_URI);
	url.searchParams.set("scope", SCOPES);
	url.searchParams.set("state", state);
	return url.toString();
}

const page = (title: string, body: string) =>
	`<!doctype html><meta charset="utf-8"><title>${title}</title>` +
	`<body style="font:16px Segoe UI,sans-serif;background:#111;color:#eee;padding:40px">` +
	`<h2>${title}</h2><p>${body}</p></body>`;

let active: { cancel: () => void } | undefined;

/**
 * Wait for Oura to redirect back with an authorization code. The server listens on both
 * loopback addresses because browsers may resolve "localhost" to ::1 or 127.0.0.1, and closes
 * as soon as a code arrives, on error, or after 5 minutes. Starting a new login cancels the old.
 */
export function waitForCode(clientId: string, openUrl: (url: string) => Promise<void> | void): Promise<string> {
	active?.cancel();
	const state = randomBytes(16).toString("hex");

	return new Promise<string>((resolve, reject) => {
		const servers: http.Server[] = [];
		let done = false;

		const finish = (err: Error | undefined, code?: string) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			active = undefined;
			// Let the response flush before closing.
			setTimeout(() => servers.forEach((s) => s.close()), 200);
			if (err) reject(err);
			else resolve(code!);
		};

		const handler: http.RequestListener = (req, res) => {
			const url = new URL(req.url ?? "/", REDIRECT_URI);
			if (url.pathname !== "/callback") {
				res.writeHead(404).end();
				return;
			}
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			const error = url.searchParams.get("error");
			if (error) {
				res.end(page("Oura login failed", `Oura said: ${escapeHtml(error)}. You can close this tab.`));
				finish(new Error(`Oura login failed: ${error}`));
				return;
			}
			if (url.searchParams.get("state") !== state) {
				res.end(page("Oura login failed", "State mismatch. Start again from Stream Deck."));
				finish(new Error("OAuth state mismatch"));
				return;
			}
			const code = url.searchParams.get("code");
			if (!code) {
				res.end(page("Oura login failed", "No authorization code in the redirect."));
				finish(new Error("No authorization code"));
				return;
			}
			res.end(page("Oura connected", "You can close this tab and return to Stream Deck."));
			finish(undefined, code);
		};

		const timer = setTimeout(() => finish(new Error("Oura login timed out")), TIMEOUT_MS);
		active = { cancel: () => finish(new Error("Oura login cancelled")) };

		let listening = 0;
		let failed = 0;
		for (const host of ["127.0.0.1", "::1"]) {
			const server = http.createServer(handler);
			servers.push(server);
			server.once("error", (err) => {
				failed++;
				if (failed === 2) finish(new Error(`Cannot listen on port ${CALLBACK_PORT}: ${err.message}`));
			});
			server.listen(CALLBACK_PORT, host, () => {
				listening++;
				if (listening === 1) void openUrl(authorizeUrl(clientId, state));
			});
		}
	});
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
