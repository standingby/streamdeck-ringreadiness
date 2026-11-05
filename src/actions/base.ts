import streamDeck, {
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DialUpEvent,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type SendToPluginEvent,
	SingletonAction,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";

import { handlePiMessage, isConnected, LONG_PRESS_MS, onAuthChange, OURA_WEB_URL, type PiMessage, startLogin, store } from "../app";
import { DEFAULT_SETTINGS, type MetricSettings } from "../data/metrics";
import { renderConnect, toDataUri } from "../render/svg";

export const MAX_OFFSET = 30;

export interface View<S extends JsonObject> {
	action: DialAction<S> | KeyAction<S>;
	settings: S;
	/** Days back from today (dial browsing). */
	offset: number;
	/** Extra per-view toggle (chart: 30-day mode). */
	wide: boolean;
	downAt?: number;
	lastImage?: string;
}

let connected = false;
void isConnected().then((c) => (connected = c));
onAuthChange(() => void isConnected().then((c) => (connected = c)));

export function metricSettings(s: { stepGoal?: unknown }): MetricSettings {
	const goal = Number(s.stepGoal);
	return { stepGoal: Number.isFinite(goal) && goal > 0 ? goal : DEFAULT_SETTINGS.stepGoal };
}

/**
 * Shared behaviour for every Oura action: visibility tracking for the loader, redraw on data
 * change, press vs long-press, dial browsing, and the account messages from the inspector.
 */
export abstract class OuraAction<S extends JsonObject> extends SingletonAction<S> {
	protected readonly views = new Map<string, View<S>>();

	constructor() {
		super();
		store.subscribe(() => this.redrawAll());
		onAuthChange(() => setTimeout(() => this.redrawAll(), 50));
		// Data age labels change even when nothing is fetched.
		setInterval(() => this.redrawAll(), 60_000).unref?.();
	}

	/** Whether this view shows live heart rate (drives the 5-minute poll). */
	protected abstract needsHr(settings: S): boolean;
	/** Return the SVG for a key (144×144) or dial strip (200×100). */
	protected abstract renderView(view: View<S>, isDial: boolean): string;
	/** Dial push (short). Default: back to today and refresh. */
	protected onDialPress(view: View<S>): void {
		view.offset = 0;
		void this.refresh(view);
	}
	/** Dial rotation. Default: browse days. */
	protected onRotate(view: View<S>, ticks: number): void {
		view.offset = Math.max(0, Math.min(MAX_OFFSET, view.offset - ticks));
		this.draw(view);
	}

	override onWillAppear(ev: WillAppearEvent<S>): void {
		const view: View<S> = { action: ev.action, settings: ev.payload.settings, offset: 0, wide: false };
		this.views.set(ev.action.id, view);
		store.setVisible(ev.action.id, this.needsHr(view.settings));
		this.draw(view);
	}

	override onWillDisappear(ev: WillDisappearEvent<S>): void {
		this.views.delete(ev.action.id);
		store.setHidden(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): void {
		const view = this.views.get(ev.action.id);
		if (!view) return;
		view.settings = ev.payload.settings;
		store.setVisible(ev.action.id, this.needsHr(view.settings));
		this.draw(view);
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, S>): void {
		const msg = ev.payload as PiMessage | null;
		if (msg && typeof msg === "object" && "type" in msg) void handlePiMessage(msg);
	}

	override onKeyDown(ev: KeyDownEvent<S>): void {
		const view = this.views.get(ev.action.id);
		if (view) view.downAt = Date.now();
	}

	override onKeyUp(ev: KeyUpEvent<S>): void {
		const view = this.views.get(ev.action.id);
		if (!view) return;
		if (this.isLongPress(view)) void streamDeck.system.openUrl(OURA_WEB_URL);
		else void this.refresh(view);
	}

	override onDialDown(ev: DialDownEvent<S>): void {
		const view = this.views.get(ev.action.id);
		if (view) view.downAt = Date.now();
	}

	override onDialUp(ev: DialUpEvent<S>): void {
		const view = this.views.get(ev.action.id);
		if (!view) return;
		if (this.isLongPress(view)) void streamDeck.system.openUrl(OURA_WEB_URL);
		else if (!connected) void startLogin();
		else this.onDialPress(view);
	}

	override onDialRotate(ev: DialRotateEvent<S>): void {
		const view = this.views.get(ev.action.id);
		if (view) this.onRotate(view, ev.payload.ticks);
	}

	override onTouchTap(ev: TouchTapEvent<S>): void {
		const view = this.views.get(ev.action.id);
		if (!view) return;
		if (ev.payload.hold) void streamDeck.system.openUrl(OURA_WEB_URL);
		else void this.refresh(view);
	}

	private isLongPress(view: View<S>): boolean {
		const held = view.downAt !== undefined && Date.now() - view.downAt >= LONG_PRESS_MS;
		view.downAt = undefined;
		return held;
	}

	protected async refresh(view: View<S>): Promise<void> {
		if (!connected) {
			void startLogin();
			return;
		}
		this.draw(view);
		const ok = await store.refresh();
		if (!ok) await view.action.showAlert();
	}

	protected redrawAll(): void {
		for (const view of this.views.values()) this.draw(view);
	}

	protected draw(view: View<S>): void {
		const isDial = view.action.isDial();
		let svg: string;
		try {
			svg = connected ? this.renderView(view, isDial) : renderConnect(isDial ? 200 : 144, isDial ? 100 : 144);
		} catch (err) {
			streamDeck.logger.error(`render failed: ${String(err)}`);
			return;
		}
		const uri = toDataUri(svg);
		if (uri === view.lastImage) return;
		view.lastImage = uri;
		if (view.action.isDial()) void view.action.setFeedback({ canvas: uri });
		else if (view.action.isKey()) void view.action.setImage(uri);
	}
}
