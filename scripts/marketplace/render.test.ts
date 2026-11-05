/**
 * Builds the Marketplace images as HTML pages from the real renderer and demo data (never real
 * user data). `npm run assets` turns them into PNGs with headless Edge (see shoot.mjs).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { it } from "vitest";

import { type DataState, formatValue, METRIC_LABELS, type MetricId, metricView, series } from "../../src/data/metrics";
import * as R from "../../src/render/svg";
import { dayLabel, shiftDate } from "../../src/util/dates";

const OUT = path.resolve(__dirname, "../../assets/marketplace/html");
const TODAY = "2026-11-05";
const NOW = new Date(`${TODAY}T09:30:00`).getTime();

/** Smooth, plausible demo values for 40 days. */
function demoState(): DataState {
	const days: DataState["days"] = {};
	for (let i = 0; i < 40; i++) {
		const d = shiftDate(TODAY, -i);
		const w = Math.sin(i * 0.9) * 0.5 + Math.sin(i * 0.37);
		days[d] = {
			readiness: Math.round(80 + w * 8),
			sleep: Math.round(82 + Math.cos(i * 0.7) * 9),
			activity: Math.round(76 + Math.sin(i * 1.3) * 12),
			steps: Math.round(8200 + Math.sin(i * 1.1) * 3200),
			stressHigh: Math.round(3600 + Math.cos(i) * 2400),
			stressSummary: i % 4 === 0 ? "stressful" : i % 3 === 0 ? "restored" : "normal",
			hrv: Math.round(48 + w * 6),
			rhr: Math.round(54 - w * 3),
		};
	}
	days[TODAY] = { ...days[TODAY], readiness: 87, sleep: 91, activity: 78, steps: 6430, hrv: 55, rhr: 51 };
	return { days, dailyFetchedAt: NOW - 3 * 60_000, hr: { bpm: 64, at: NOW - 12 * 60_000 } };
}

const state = demoState();
const view = (m: MetricId, day = TODAY) => metricView(state, m, day, TODAY, NOW, { stepGoal: 8000 });
const strip = (m: MetricId, day = TODAY) =>
	R.renderMetricStrip(view(m, day), m === "hr" ? "Latest" : dayLabel(day, TODAY), m === "hr" ? undefined : series(state, m, day, 7));
const chart = (m: MetricId, n: number) => {
	const points = series(state, m, TODAY, n);
	const last = points.at(-1)!;
	return {
		metric: m,
		label: METRIC_LABELS[m].label,
		points,
		highlight: n - 1,
		highlightText: last.value !== undefined ? formatValue(m, last.value) : "—",
		dayText: "Today",
		age: "3m",
	};
};
const summary = (day = TODAY) => {
	const v = (m: "readiness" | "sleep" | "activity" | "steps") => view(m, day);
	return { readiness: v("readiness"), sleep: v("sleep"), activity: v("activity"), steps: v("steps"), dayText: dayLabel(day, TODAY) };
};

const FONT = "Segoe UI, Arial, sans-serif";
const page = (w: number, h: number, body: string) => `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:${FONT};color:#F1F5F9}
body{background:radial-gradient(ellipse at 30% 20%,#1E2633 0%,#0B0D10 70%)}
.key{width:144px;height:144px;border-radius:18px;overflow:hidden;box-shadow:0 0 0 6px #050607,0 18px 40px #0008}
.key svg,.strip svg{display:block}
.strip{width:200px;height:100px;overflow:hidden}
.deck{display:inline-flex;gap:0;padding:14px;background:#050607;border-radius:22px;box-shadow:0 30px 80px #000a}
.row{display:flex;gap:34px;align-items:center}
.z2{zoom:2}.z15{zoom:1.5}.z25{zoom:2.5}
h1{font-size:76px;margin:0 0 8px;font-weight:700;letter-spacing:-1px}
p{font-size:30px;margin:0;color:#94A3B8}
.cap{font-size:26px;color:#94A3B8;margin-top:22px;text-align:center}
</style><body>${body}</body>`;
const key = (svg: string) => `<div class="key">${svg}</div>`;
const strips = (...svgs: string[]) => `<div class="deck">${svgs.map((s) => `<div class="strip">${s}</div>`).join("")}</div>`;

it("writes marketplace pages", () => {
	mkdirSync(OUT, { recursive: true });
	const write = (name: string, html: string) => writeFileSync(path.join(OUT, `${name}.html`), html);

	// 288×288 app icon: three score rings, no third-party marks.
	write(
		"icon",
		`<!doctype html><style>html,body{margin:0;width:288px;height:288px;background:#111316}</style><body>
<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288" viewBox="0 0 288 288">
<rect width="288" height="288" rx="56" fill="#111316"/>
<circle cx="144" cy="144" r="96" fill="none" stroke="#2A2F37" stroke-width="22"/>
<path d="M144 48 A96 96 0 1 1 52.7 173.7" fill="none" stroke="${R.COLORS.optimal}" stroke-width="22" stroke-linecap="round"/>
<circle cx="144" cy="144" r="58" fill="none" stroke="#2A2F37" stroke-width="18"/>
<path d="M144 86 A58 58 0 1 1 86.6 152.2" fill="none" stroke="${R.COLORS.good}" stroke-width="18" stroke-linecap="round"/>
<circle cx="144" cy="144" r="22" fill="${R.COLORS.attention}"/></svg></body>`,
	);

	write(
		"thumbnail",
		page(1920, 960, `<div style="display:flex;height:100%;align-items:center;padding:0 120px;gap:110px">
<div style="flex:0 0 640px"><h1>Ring Readiness</h1><p>Your ring's readiness, sleep, activity, stress, HRV and heart rate on Stream Deck and Stream Deck+.</p>
<p style="margin-top:28px;font-size:22px;color:#64748B">For Oura Ring members. Not affiliated with or endorsed by Oura.</p></div>
<div class="z2" style="display:flex;flex-direction:column;gap:22px">
<div class="row" style="gap:18px">${key(R.renderMetricKey(view("readiness")))}${key(R.renderMetricKey(view("sleep")))}${key(R.renderSummaryKey(summary()))}</div>
${strips(strip("readiness"), R.renderSummaryStrip(summary()))}</div></div>`),
	);

	write(
		"gallery-1-keys",
		page(1920, 960, `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center">
<div class="z2" style="display:grid;grid-template-columns:repeat(4,144px);gap:22px">
${(["readiness", "sleep", "activity", "steps", "stress", "hrv", "rhr", "hr"] as const).map((m) => key(R.renderMetricKey(view(m)))).join("")}</div>
<div class="cap">Eight metrics on one action. Press to cycle, hold to refresh. Colours follow the score bands.</div></div>`),
	);

	write(
		"gallery-2-dials",
		page(1920, 960, `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;gap:40px">
<div class="z2">${strips(strip("readiness"), strip("hrv"), strip("steps"), strip("hr"))}</div>
<div class="z2">${strips(strip("sleep", shiftDate(TODAY, -3)), R.renderSummaryStrip(summary()), R.renderChartStrip(chart("readiness", 7), "7D"), R.renderChartStrip(chart("steps", 30), "30D"))}</div>
<div class="cap">Stream Deck+ dials: rotate to browse 30 days, push for the next metric, 7 or 30 day trends.</div></div>`),
	);

	write(
		"gallery-3-states",
		page(1920, 960, `<div style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center">
<div class="z2 row" style="gap:22px">
${key(R.renderChartKey({ ...chart("sleep", 7), highlight: 6 }))}
${key(R.renderSummaryKey(summary()))}
${key(R.renderMetricKey(metricView({ ...state, dailyError: "offline" }, "readiness", TODAY, TODAY, NOW)))}
${key(R.renderConnect(144, 144))}</div>
<div class="cap">Trend charts, a day summary, honest offline state with data age, one-click connect.</div></div>`),
	);
});
