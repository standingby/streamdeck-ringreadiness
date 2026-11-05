import streamDeck from "@elgato/streamdeck";

import { ChartAction } from "./actions/chart";
import { MetricAction } from "./actions/metric";
import { SummaryAction } from "./actions/summary";
import { dataReady, store } from "./app";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new MetricAction());
streamDeck.actions.registerAction(new ChartAction());
streamDeck.actions.registerAction(new SummaryAction());

// After sleep the data is stale; let the next tick decide what is due.
streamDeck.system.onSystemDidWakeUp(() => void store.tick());

await dataReady;
await store.init();
await streamDeck.connect();
