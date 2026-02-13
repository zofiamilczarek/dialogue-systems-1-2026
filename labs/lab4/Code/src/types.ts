import type { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import type { ActorRef } from "xstate";

export interface DMContext {
  spstRef: ActorRef<any, any>;
  lastResult: Hypothesis[] | null;
}

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" } | { type: "DONE" };
