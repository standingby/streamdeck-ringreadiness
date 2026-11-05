import { action } from "@elgato/streamdeck";

import { store } from "../app";
import { metricView } from "../data/metrics";
import { renderSummaryKey, renderSummaryStrip, type SummaryModel } from "../render/svg";
import { dayLabel, shiftDate, todayLocal } from "../util/dates";
import { metricSettings, OuraAction, type View } from "./base";

export type SummarySettings = { stepGoal?: number };

@action({ UUID: "kz.standingby.ringreadiness.summary" })
export class SummaryAction extends OuraAction<SummarySettings> {
	protected needsHr(): boolean {
		return false;
	}

	protected renderView(view: View<SummarySettings>, isDial: boolean): string {
		const now = Date.now();
		const today = todayLocal(now);
		const day = isDial ? shiftDate(today, -view.offset) : today;
		const settings = metricSettings(view.settings);
		const v = (m: "readiness" | "sleep" | "activity" | "steps") => metricView(store.state, m, day, today, now, settings);
		const model: SummaryModel = {
			readiness: v("readiness"),
			sleep: v("sleep"),
			activity: v("activity"),
			steps: v("steps"),
			dayText: dayLabel(day, today),
		};
		return isDial ? renderSummaryStrip(model) : renderSummaryKey(model);
	}
}
