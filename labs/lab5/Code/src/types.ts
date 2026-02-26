import type { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import type { ActorRef } from "xstate";

export interface DMContext {
  spstRef: ActorRef<any, any>;
  lastResult: Hypothesis[] | null;
  interpretation: NLUObject | null;
}

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" } | { type: "DONE" };

export interface Entity { // This is the type of the entities array in the NLUObject. 
  category: string;
  text: string;
  confidenceScore: number;
  offset: number;
  length: number;
}

export interface Intent { // This is the type of the intents array in the NLUObject.
  category: string;
  confidenceScore: number;
}

export interface NLUObject { // This is the type of the interpretation in the DMContext.
  entities: Entity[];
  intents: Intent[];
  projectKind: string;
  topIntent: string;
}