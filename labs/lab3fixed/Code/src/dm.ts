import { assign, createActor, setup } from "xstate";
import type { Hypothesis, Settings } from "speechstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure";
import type { DMContext, DMEvents } from "./types";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://francecentral.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings: Settings = {
  azureCredentials: azureCredentials,
  azureRegion: "francecentral",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

interface GrammarEntry {
  person?: string;
  day?: string;
  time?: string;
  confirmation?: string;
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  bora: { person: "Bora Kara" },
  tal: { person: "Talha Bedir" },
  tom: { person: "Tom Södahl Bladsjö" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
  saturday: { day: "Saturday" },
  sunday: { day: "Sunday" },
  "yes": {confirmation: "yes"},
  "yeah": {confirmation: "yes"},
  "sure": {confirmation: "yes"},
  "why not": {confirmation: "yes"},
  "yup": {confirmation: "yes"},
  "ok": {confirmation: "yes"},
  "nope": {confirmation: "no"},
  "nah": {confirmation: "no"},
  "not sure": {confirmation: "no"},
  "no": {confirmation: "no"},
};

for (let h = 0; h <= 12; h++) {
  const key = String(h)
  grammar[key] = { time: `${key.padStart(2, "0")}:00` };
}

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function isConfirmation(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).confirmation == "yes";
}

function isRejection(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).confirmation == "no";
}


const dmMachine = setup({
  types: {
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    "spst.speak": ({ context }, params: { utterance: string }) =>
      context.spstRef.send({
        type: "SPEAK",
        value: {
          utterance: params.utterance,
        },
      }),
    "spst.listen": ({ context }) =>
      context.spstRef.send({
        type: "LISTEN",
      }),
  },
}).createMachine({
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
    appt: {},
  }),
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: { CLICK: "Dialogue.Greeting" },
    },
    Ask: {
      entry: { type: "spst.listen" },
      on: {
        RECOGNISED: {
          actions: assign(({ event }) => ({
            lastResult: event.value,
          })),
          target: "Dialogue.hist",
        }, 
        ASR_NOINPUT: {
          actions: assign({ lastResult: null }),
          // target: "Dialogue.NoInput",
        },
      },
    },
    NoInput: {
      entry: {
        type: "spst.speak",
        params: { utterance: `I can't hear you!` },
      },
      on: { SPEAK_COMPLETE: "Ask" },
    },
    Dialogue: {
      id: "Dialogue",
      initial: "Greeting",
      states: {
        hist: {
          type: "history",
          history: "deep",
        },
        Greeting: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              {
                target: "StartPrompt",
                guard: ({ context }) => !!context.lastResult,
              },
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: { utterance: `Hi!` } },
              on: { SPEAK_COMPLETE: "#DM.Ask" },
            },
          },
        },
        StartPrompt: {
          entry: {type: "spst.speak", params: {utterance: "Let's create an appointment"}},
          on: {SPEAK_COMPLETE: "WhoPrompt"},
        },
        WhoPrompt: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              {
                target: "#DM.Done",
                guard: ({ context }) => !!context.lastResult,
              },
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: { utterance: `Who are you meeting with?` } },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            NoInput: {
              entry: {
                type: "spst.speak",
                params: { utterance: `I can't hear you!` },
              },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => {
                    return { lastResult: event.value };
                  }),
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                },
              },
            },
          },
        },
      },
    },
    Done: {
      on: {
        CLICK: "Dialogue.Greeting",
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => {
    const meta: { view?: string } = Object.values(
      snapshot.context.spstRef.getSnapshot().getMeta(),
    )[0] || {
      view: undefined,
    };
    element.innerHTML = `${meta.view}`;
  });
}
