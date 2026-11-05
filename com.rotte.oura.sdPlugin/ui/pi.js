// Minimal property inspector client: settings form + Oura account block.
(() => {
	let ws, uuid, actionUuid, settings = {};

	const $ = (sel) => document.querySelector(sel);
	const send = (event, payload) => ws?.readyState === 1 && ws.send(JSON.stringify({ event, context: uuid, action: actionUuid, payload }));
	const toPlugin = (payload) => send("sendToPlugin", payload);

	const ACCOUNT_HTML = `
		<h3>Oura account</h3>
		<div class="status" id="acc-status">Checking…</div>
		<div class="msg" id="acc-msg"></div>
		<div class="row"><label for="acc-id">Client ID</label><input id="acc-id" autocomplete="off" spellcheck="false"></div>
		<div class="row"><label for="acc-secret">Client secret</label><input id="acc-secret" type="password" autocomplete="off"></div>
		<div class="row"><label></label><button class="primary" id="acc-connect">Connect Oura</button><button id="acc-disconnect">Disconnect</button></div>
		<div class="hint">Redirect URI for your Oura app: <code id="acc-redirect">http://localhost:51789/callback</code></div>
		<details><summary>Advanced: personal access token</summary>
			<div class="row"><label for="acc-pat">Token</label><input id="acc-pat" type="password" autocomplete="off"></div>
			<div class="row"><label></label><button id="acc-pat-save">Save token</button></div>
			<div class="hint">Used only when OAuth is not connected. Leave empty and save to remove.</div>
		</details>`;

	function renderStatus(s) {
		const label = s.method === "oauth" ? '<b class="ok">Connected (OAuth)</b>'
			: s.method === "pat" ? '<b class="ok">Connected (personal token)</b>'
			: '<b class="off">Not connected</b>';
		$("#acc-status").innerHTML = label + (s.loginInFlight ? " · waiting for browser…" : "");
		if (s.clientId && !$("#acc-id").value) $("#acc-id").value = s.clientId;
		$("#acc-secret").placeholder = s.hasClientSecret ? "saved (leave empty to keep)" : "";
		$("#acc-pat").placeholder = s.hasPat ? "saved" : "";
		$("#acc-disconnect").hidden = s.method !== "oauth";
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
		$("#acc-pat-save").onclick = () => {
			toPlugin({ type: "savePat", pat: $("#acc-pat").value });
			$("#acc-pat").value = "";
		};
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
