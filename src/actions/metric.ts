import { action } from "@elgato/streamdeck";

import { store } from "../app";
import { isMetric, type MetricId, metricView, nextMetric, series } from "../data/metrics";
import { renderMetricKey, renderMetricStrip } from "../render/svg";
import { dayLabel, shiftDate, todayLocal } from "../util/dates";
import { metricSettings, OuraAction, type PressSource, type View } from "./base";

export type MetricActionSettings = { metric?: MetricId; stepGoal?: number };

const metricOf = (s: MetricActionSettings): MetricId => (isMetric(s.metric) ? s.metric : "readiness");

@action({ UUID: "kz.standingby.ringreadiness.metric" })
export class MetricAction extends OuraAction<MetricActionSettings> {
	protected needsHr(s: MetricActionSettings): boolean {
		return metricOf(s) === "hr";
	}

	/** Press cycles through all metrics; the browsed day is kept. */
	protected override onPress(view: View<MetricActionSettings>, _source: PressSource): void {
		this.updateSettings(view, { ...view.settings, metric: nextMetric(metricOf(view.settings)) });
	}

	protected override onRotate(view: View<MetricActionSettings>, ticks: number): void {
		// Live heart rate has no days to browse.
		if (metricOf(view.settings) === "hr") return;
		super.onRotate(view, ticks);
	}

	protected renderView(view: View<MetricActionSettings>, isDial: boolean): string {
		const now = Date.now();
		const today = todayLocal(now);
		const metric = metricOf(view.settings);
		const day = shiftDate(today, -view.offset);
		const settings = metricSettings(view.settings);
		const v = metricView(store.state, metric, day, today, now, settings);
		if (!isDial) return renderMetricKey(v);
		const recent = metric === "hr" ? undefined : series(store.state, metric, day, 7, settings);
		const dayText = metric === "hr" ? "Latest" : dayLabel(day, today);
		return renderMetricStrip(v, dayText, recent);
	}
}
