// Minimal property inspector client: settings form + Oura account block.
(() => {
	let ws, uuid, actionUuid, settings = {};

	const $ = (sel) => document.querySelector(sel);
	const send = (event, payload) => ws?.readyState === 1 && ws.send(JSON.stringify({ event, context: uuid, action: actionUuid, payload }));
	// Property inspectors cannot follow links themselves; Stream Deck opens them in the browser.
	const toPlugin = (payload) => send("sendToPlugin", payload);

	const ACCOUNT_HTML = `
		<h3>Oura account</h3>
		<div class="status" id="acc-status">Checking…</div>
		<div class="msg" id="acc-msg"></div>
		<details id="acc-help"><summary>First time? Create your Oura API app (5 min)</summary>
			<ol class="hint">
				<li>Open <a href="#" data-url="https://developer.ouraring.com">developer.ouraring.com</a> and sign in with your Oura account.</li>
				<li>Create a new application. Any name works; the website and privacy fields can point to any page you own.</li>
				<li>Add the redirect URI <code id="acc-redirect">http://localhost:51789/callback</code> exactly.</li>
				<li>Enable the <b>daily</b>, <b>heartrate</b> and <b>personal</b> scopes and save.</li>
				<li>Copy the Client ID and Client Secret into the fields below, then press Connect.</li>
			</ol>
			<div class="hint">Your Oura data needs an active Oura Membership to be available through the API.</div>
		</details>
		<div class="row"><label for="acc-id">Client ID</label><input id="acc-id" autocomplete="off" spellcheck="false"></div>
		<div class="row"><label for="acc-secret">Client secret</label><input id="acc-secret" type="password" autocomplete="off"></div>
		<div class="row"><label></label><button class="primary" id="acc-connect">Connect to Oura</button><button id="acc-disconnect">Disconnect</button></div>
		<div class="hint" id="acc-disc-hint">Disconnect deletes your tokens and all cached data from this PC.</div>
		<div class="hint">Not affiliated with or endorsed by Oura.</div>`;

	function renderStatus(s) {
		const label = s.method === "oauth" ? '<b class="ok">Connected</b>'
			: '<b class="off">Not connected</b>';
		$("#acc-status").innerHTML = label + (s.loginInFlight ? " · waiting for browser…" : "");
		if (s.clientId && !$("#acc-id").value) $("#acc-id").value = s.clientId;
		$("#acc-secret").placeholder = s.hasClientSecret ? "saved (leave empty to keep)" : "";
		$("#acc-disconnect").hidden = s.method !== "oauth";
		$("#acc-disc-hint").hidden = s.method !== "oauth";
		$("#acc-help").open = s.method !== "oauth" && !s.clientId;
		if (s.redirectUri) $("#acc-redirect").textContent = s.redirectUri;
		$("#acc-msg").textContent = s.message ?? "";
	}

	function readForm() {
		const out = {};
		document.querySelectorAll("[data-setting]").forEach((el) => {
			const v = el.type === "number" ? (el.value === "" ? undefined : Number(el.value)) : el.value;
			if (v !== undefined) out[el.dataset.setting] = v;
		});
		return out;
	}

	function fillForm() {
		document.querySelectorAll("[data-setting]").forEach((el) => {
			const v = settings[el.dataset.setting];
			if (v !== undefined) el.value = String(v);
		});
		window.onSettingsShown?.(settings);
	}

	function bind() {
		const acc = $("#account");
		if (acc) acc.innerHTML = ACCOUNT_HTML;
		document.querySelectorAll("[data-setting]").forEach((el) =>
			el.addEventListener("change", () => {
				settings = { ...settings, ...readForm() };
				send("setSettings", settings);
				window.onSettingsShown?.(settings);
			}));
		if (!acc) return;
		$("#acc-connect").onclick = () => {
			$("#acc-msg").textContent = "Opening browser…";
			toPlugin({ type: "connect", clientId: $("#acc-id").value, clientSecret: $("#acc-secret").value });
			$("#acc-secret").value = "";
		};
		$("#acc-disconnect").onclick = () => toPlugin({ type: "disconnect" });
		document.querySelectorAll("[data-url]").forEach((a) => (a.onclick = (e) => {
			e.preventDefault();
			send("openUrl", { url: a.dataset.url });
		}));
	}

	window.connectElgatoStreamDeckSocket = (port, inUuid, registerEvent, _info, actionInfo) => {
		uuid = inUuid;
		const info = JSON.parse(actionInfo);
		actionUuid = info.action;
		settings = info.payload?.settings ?? {};
		bind();
		fillForm();
		ws = new WebSocket(`ws://127.0.0.1:${port}`);
		ws.onopen = () => {
			ws.send(JSON.stringify({ event: registerEvent, uuid }));
			toPlugin({ type: "status" });
		};
		ws.onmessage = (e) => {
			const msg = JSON.parse(e.data);
			if (msg.event === "didReceiveSettings") {
				settings = msg.payload?.settings ?? {};
				fillForm();
			} else if (msg.event === "sendToPropertyInspector" && msg.payload?.type === "status") {
				renderStatus(msg.payload);
			}
		};
	};
})();
