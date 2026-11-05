import { describe, expect, it } from "vitest";

import { bundleToDays, type DataState, metricView, series } from "../src/data/metrics";
import {
	COLORS,
	renderChartKey,
	renderChartStrip,
	renderConnect,
	renderMetricKey,
	renderMetricStrip,
	renderSummaryKey,
	renderSummaryStrip,
	toDataUri,
} from "../src/render/svg";
import { syntheticBundle } from "./fixtures/bundle";

const TODAY = "2026-11-05";
const NOW = new Date("2026-11-05T10:00:00").getTime();
const state: DataState = { days: bundleToDays(syntheticBundle()), dailyFetchedAt: NOW - 120_000 };

/** Cheap well-formedness check: balanced tags and the expected canvas size. */
function expectSvg(svg: string, w: number, h: number) {
	expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"`)).toBe(true);
	expect(svg.endsWith("</svg>")).toBe(true);
	const open = (svg.match(/<(text|g|svg)\b/g) ?? []).length;
	const close = (svg.match(/<\/(text|g|svg)>/g) ?? []).length;
	expect(open).toBe(close);
	expect(svg).not.toMatch(/NaN|undefined/);
}

describe("renderers", () => {
	it("draws every metric on a key and a strip", () => {
		for (const m of ["readiness", "sleep", "activity", "steps", "stress", "hrv", "rhr", "hr"] as const) {
			const v = metricView(state, m, TODAY, TODAY, NOW);
			expectSvg(renderMetricKey(v), 144, 144);
			expectSvg(renderMetricStrip(v, "Today", m === "hr" ? undefined : series(state, m, TODAY, 7)), 200, 100);
		}
	});

	it("colours the sleep ring with the optimal tone", () => {
		const svg = renderMetricKey(metricView(state, "sleep", TODAY, TODAY, NOW));
		expect(svg).toContain(COLORS.optimal);
		expect(svg).toContain(">91<");
		expect(svg).toContain(">2m<");
	});

	it("shows the error badge", () => {
		const v = metricView({ ...state, dailyError: "reauth" }, "sleep", TODAY, TODAY, NOW);
		expect(renderMetricKey(v)).toContain(">REAUTH<");
	});

	it("draws charts and summaries", () => {
		const points = series(state, "readiness", TODAY, 30);
		const model = { metric: "readiness" as const, label: "Readiness", points, highlight: 28, highlightText: "74", dayText: "Yday", age: "2m" };
		expectSvg(renderChartKey({ ...model, points: points.slice(-7), highlight: 5 }), 144, 144);
		expectSvg(renderChartStrip(model, "30D"), 200, 100);
		const v = (m: "readiness" | "sleep" | "activity" | "steps") => metricView(state, m, TODAY, TODAY, NOW);
		const s = { readiness: v("readiness"), sleep: v("sleep"), activity: v("activity"), steps: v("steps"), dayText: "Today" };
		expectSvg(renderSummaryKey(s), 144, 144);
		expectSvg(renderSummaryStrip(s), 200, 100);
		expectSvg(renderConnect(144, 144), 144, 144);
	});

	it("encodes as a base64 data URI", () => {
		const uri = toDataUri(renderConnect(200, 100));
		expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
		expect(Buffer.from(uri.split(",")[1]!, "base64").toString("utf8")).toContain("Connect Oura");
	});
});
