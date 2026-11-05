import type { MetricId, MetricView, SeriesPoint, Tone } from "../data/metrics";

export const COLORS = {
	bg: "#111316",
	track: "#2A2F37",
	text: "#F1F5F9",
	muted: "#8B95A5",
	optimal: "#34D399",
	good: "#FBBF24",
	attention: "#FB923C",
	neutral: "#E2E8F0",
	badge: "#F87171",
} as const;

const FONT = "Segoe UI, Arial, sans-serif";

export function toneColor(tone: Tone): string {
	return COLORS[tone];
}

export function toDataUri(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function svg(w: number, h: number, body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
		`<rect width="${w}" height="${h}" fill="${COLORS.bg}"/>${body}</svg>`;
}

function text(
	x: number,
	y: number,
	content: string,
	opts: { size: number; fill?: string; weight?: number; anchor?: "start" | "middle" | "end"; opacity?: number },
): string {
	return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${opts.size}" font-weight="${opts.weight ?? 400}" ` +
		`fill="${opts.fill ?? COLORS.text}" text-anchor="${opts.anchor ?? "start"}"` +
		(opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : "") +
		`>${esc(content)}</text>`;
}

/** Arc from 12 o'clock clockwise covering `fraction` of a circle. */
function ring(cx: number, cy: number, r: number, width: number, fraction: number | undefined, color: string): string {
	let out = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COLORS.track}" stroke-width="${width}"/>`;
	if (fraction === undefined || fraction <= 0) return out;
	if (fraction >= 0.999) {
		return out + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
	}
	const angle = fraction * 2 * Math.PI;
	const x = cx + r * Math.sin(angle);
	const y = cy - r * Math.cos(angle);
	const large = fraction > 0.5 ? 1 : 0;
	out += `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}" fill="none" ` +
		`stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
	return out;
}

const ARROWS = { up: "↑", down: "↓", flat: "→" } as const;

/** Left: note or error badge; right: data age. */
function footer(v: Pick<MetricView, "badge" | "note" | "age">, y: number, w: number, size: number, pad: number): string {
	let out = "";
	if (v.badge) out += text(pad, y, v.badge.toUpperCase(), { size, fill: COLORS.badge, weight: 600 });
	else if (v.note) out += text(pad, y, v.note, { size, fill: COLORS.muted });
	if (v.age) out += text(w - pad, y, v.age, { size, fill: COLORS.muted, anchor: "end" });
	return out;
}

function valueColor(v: MetricView): string {
	return v.tone === "neutral" ? COLORS.text : toneColor(v.tone);
}

/** 144×144 key for one metric. */
export function renderMetricKey(v: MetricView): string {
	const opacity = v.dim ? 0.45 : 1;
	let body = text(72, 26, v.short, { size: 15, fill: COLORS.muted, weight: 600, anchor: "middle" });
	let main = "";
	if (v.fraction !== undefined || v.metric === "readiness" || v.metric === "sleep" || v.metric === "activity") {
		main += ring(72, 78, 37, 8, v.fraction, toneColor(v.tone));
		main += text(72, 90, v.text, { size: v.text.length > 4 ? 22 : 32, weight: 700, anchor: "middle" });
	} else {
		const size = v.text.length > 5 ? 28 : v.text.length > 3 ? 36 : 46;
		main += text(72, 92, v.text, { size, weight: 700, fill: valueColor(v), anchor: "middle" });
		const sub = [v.unit, v.trend ? ARROWS[v.trend] : ""].filter(Boolean).join(" ");
		if (sub) main += text(72, 114, sub, { size: 15, fill: COLORS.muted, anchor: "middle" });
	}
	body += `<g opacity="${opacity}">${main}</g>`;
	body += footer(v, 136, 144, 13, 10);
	return svg(144, 144, body);
}

/** Bars for a series inside a box; `highlight` = index drawn at full strength. */
function bars(
	points: SeriesPoint[],
	metric: MetricId,
	box: { x: number; y: number; w: number; h: number },
	highlight?: number,
): string {
	const values = points.map((p) => p.value).filter((x): x is number => x !== undefined);
	if (values.length === 0) return "";
	const fixed = metric === "readiness" || metric === "sleep" || metric === "activity";
	const max = fixed ? 100 : Math.max(...values);
	const min = fixed || metric === "steps" || metric === "stress" ? 0 : Math.min(...values) * 0.85;
	const gap = points.length > 14 ? 1 : 3;
	const bw = (box.w - gap * (points.length - 1)) / points.length;
	let out = "";
	points.forEach((p, i) => {
		const x = box.x + i * (bw + gap);
		if (p.value === undefined) {
			out += `<rect x="${x.toFixed(1)}" y="${box.y + box.h - 2}" width="${bw.toFixed(1)}" height="2" fill="${COLORS.track}"/>`;
			return;
		}
		const frac = max > min ? (p.value - min) / (max - min) : 1;
		const h = Math.max(3, frac * box.h);
		const color = p.tone === "neutral" ? COLORS.neutral : toneColor(p.tone);
		const op = highlight === undefined || highlight === i ? 1 : 0.45;
		out += `<rect x="${x.toFixed(1)}" y="${(box.y + box.h - h).toFixed(1)}" width="${bw.toFixed(1)}" ` +
			`height="${h.toFixed(1)}" rx="${Math.min(2, bw / 2).toFixed(1)}" fill="${color}" opacity="${op}"/>`;
	});
	return out;
}

/** 200×100 dial strip for one metric with a 7-day mini chart. */
export function renderMetricStrip(v: MetricView, dayText: string, recent: SeriesPoint[] | undefined): string {
	const opacity = v.dim ? 0.45 : 1;
	let body = text(12, 20, v.label.toUpperCase(), { size: 13, fill: COLORS.muted, weight: 600 });
	body += text(188, 20, dayText, { size: 13, fill: COLORS.muted, anchor: "end" });
	let main = text(12, 66, v.text, { size: v.text.length > 5 ? 30 : 40, weight: 700, fill: valueColor(v) });
	const sub = [v.unit, v.trend ? ARROWS[v.trend] : ""].filter(Boolean).join(" ");
	if (sub) main += text(12, 82, sub, { size: 12, fill: COLORS.muted });
	if (recent) main += bars(recent, v.metric, { x: 120, y: 32, w: 68, h: 44 }, recent.length - 1);
	body += `<g opacity="${opacity}">${main}</g>`;
	body += footer(v, 95, 200, 12, 12);
	return svg(200, 100, body);
}

export interface ChartModel {
	metric: MetricId;
	label: string;
	points: SeriesPoint[];
	highlight: number;
	highlightText: string;
	dayText: string;
	badge?: MetricView["badge"];
	age?: string;
}

export function renderChartKey(c: ChartModel): string {
	let body = text(72, 24, c.label.toUpperCase(), { size: 14, fill: COLORS.muted, weight: 600, anchor: "middle" });
	body += bars(c.points, c.metric, { x: 12, y: 36, w: 120, h: 66 }, c.highlight);
	body += text(72, 122, c.highlightText, { size: 16, weight: 700, anchor: "middle" });
	body += footer({ badge: c.badge, age: c.age }, 138, 144, 12, 10);
	return svg(144, 144, body);
}

export function renderChartStrip(c: ChartModel, modeText: string): string {
	let body = text(12, 18, `${c.label.toUpperCase()} · ${modeText}`, { size: 12, fill: COLORS.muted, weight: 600 });
	body += text(188, 18, `${c.dayText} ${c.highlightText}`, { size: 13, weight: 700, anchor: "end" });
	body += bars(c.points, c.metric, { x: 12, y: 28, w: 176, h: 52 }, c.highlight);
	body += footer({ badge: c.badge, age: c.age }, 96, 200, 11, 12);
	return svg(200, 100, body);
}

export interface SummaryModel {
	readiness: MetricView;
	sleep: MetricView;
	activity: MetricView;
	steps: MetricView;
	dayText: string;
}

export function renderSummaryKey(s: SummaryModel): string {
	const items = [s.readiness, s.sleep, s.activity];
	const letters = ["R", "S", "A"];
	let body = "";
	items.forEach((v, i) => {
		const cx = 25 + i * 47;
		body += `<g opacity="${v.dim ? 0.45 : 1}">`;
		body += ring(cx, 62, 17, 4.5, v.fraction, toneColor(v.tone));
		body += text(cx, 68, v.text, { size: 15, weight: 700, anchor: "middle" });
		body += `</g>`;
		body += text(cx, 100, letters[i]!, { size: 13, fill: COLORS.muted, weight: 600, anchor: "middle" });
	});
	body += text(72, 24, s.dayText === "Today" ? "OURA" : s.dayText, { size: 14, fill: COLORS.muted, weight: 600, anchor: "middle" });
	body += footer({ badge: s.readiness.badge, age: s.readiness.age }, 136, 144, 13, 10);
	return svg(144, 144, body);
}

export function renderSummaryStrip(s: SummaryModel): string {
	const items = [s.readiness, s.sleep, s.activity];
	let body = "";
	items.forEach((v, i) => {
		const cx = 36 + i * 64;
		body += text(cx, 18, v.short, { size: 11, fill: COLORS.muted, weight: 600, anchor: "middle" });
		body += text(cx, 54, v.text, { size: 30, weight: 700, fill: valueColor(v), anchor: "middle", opacity: v.dim ? 0.45 : 1 });
	});
	const steps = s.steps.value !== undefined ? `${s.steps.value.toLocaleString("en-US")} steps` : "— steps";
	body += text(12, 80, steps, { size: 13, fill: s.steps.tone === "neutral" ? COLORS.text : toneColor(s.steps.tone), opacity: s.steps.dim ? 0.45 : 1 });
	body += text(188, 80, s.dayText, { size: 13, fill: COLORS.muted, anchor: "end" });
	body += footer({ badge: s.readiness.badge, age: s.readiness.age }, 96, 200, 11, 12);
	return svg(200, 100, body);
}

/** Shown when no credentials exist yet. */
export function renderConnect(w: number, h: number): string {
	const cx = w / 2;
	const cy = h / 2;
	let body = ring(cx, cy - 10, Math.min(w, h) * 0.16, 5, 1, COLORS.muted);
	body += text(cx, cy + Math.min(w, h) * 0.3, "Connect Oura", { size: h > 120 ? 16 : 14, weight: 600, anchor: "middle" });
	return svg(w, h, body);
}
