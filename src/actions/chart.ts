import { action } from "@elgato/streamdeck";

import { store } from "../app";
import { formatValue, isMetric, METRIC_LABELS, type MetricId, metricView, series } from "../data/metrics";
import { type ChartModel, renderChartKey, renderChartStrip } from "../render/svg";
import { dayLabel, todayLocal } from "../util/dates";
import { metricSettings, OuraAction, type View } from "./base";

export type ChartSettings = { metric?: MetricId; stepGoal?: number };

const metricOf = (s: ChartSettings): MetricId => (isMetric(s.metric) && s.metric !== "hr" ? s.metric : "readiness");

@action({ UUID: "com.rotte.oura.chart" })
export class ChartAction extends OuraAction<ChartSettings> {
	protected needsHr(): boolean {
		return false;
	}

	/** Dial push toggles 7 / 30 days. */
	protected override onDialPress(view: View<ChartSettings>): void {
		view.wide = !view.wide;
		view.offset = Math.min(view.offset, (view.wide ? 30 : 7) - 1);
		this.draw(view);
	}

	/** Rotation moves the highlighted day inside the window. */
	protected override onRotate(view: View<ChartSettings>, ticks: number): void {
		const count = view.wide ? 30 : 7;
		view.offset = Math.max(0, Math.min(count - 1, view.offset - ticks));
		this.draw(view);
	}

	protected renderView(view: View<ChartSettings>, isDial: boolean): string {
		const now = Date.now();
		const today = todayLocal(now);
		const metric = metricOf(view.settings);
		const settings = metricSettings(view.settings);
		const count = isDial && view.wide ? 30 : 7;
		const points = series(store.state, metric, today, count, settings);
		const offset = isDial ? Math.min(view.offset, count - 1) : 0;
		const highlight = count - 1 - offset;
		const point = points[highlight]!;
		const summary = metricView(store.state, metric, today, today, now, settings);
		const model: ChartModel = {
			metric,
			label: METRIC_LABELS[metric].label,
			points,
			highlight,
			highlightText: point.value !== undefined ? formatValue(metric, point.value) : "—",
			dayText: dayLabel(point.day, today),
			badge: summary.badge,
			age: summary.age,
		};
		return isDial ? renderChartStrip(model, view.wide ? "30D" : "7D") : renderChartKey(model);
	}
}
