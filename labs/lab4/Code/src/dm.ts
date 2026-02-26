import { assign, createActor, setup } from "xstate";
import type { Settings } from "speechstate";
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

// adding timestamps
for (let h = 0; h <= 12; h++) {
  const key = String(h)
  grammar[key] = { time: `${key.padStart(2, "0")}:00` };
}


console.log(grammar);

function getName(utterance: string) {
  utterance = utterance.match(/((?<=(meeting |meet |with ))[A-Z][a-zA-z]+|^[A-Z][a-zA-z]+$)/)?.[0] ?? ""
  return (grammar[utterance.toLowerCase()] || {}).person ?? undefined;
}

function getDay(utterance: string) {
  utterance = utterance.match(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/)?.[0] ?? ""
  console.log(`day: ${utterance}`)
  return (grammar[utterance.toLowerCase()] || {}).day ?? undefined;
}

function getTime(utterance: string) {
  utterance = utterance.match(/[0-9]{1,2}/)?.[0] ?? ""
  return (grammar[utterance.toLowerCase()] || {}).time ?? undefined;
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
    "resetVars" : assign(() => ({
            lastResult: null,
            appt: {
              name: undefined,
              day: undefined,
              time: undefined,
            },
      })),
  },
  guards:{
    isYes: ({context}) => (grammar[context.lastResult ? context.lastResult?.[0]?.utterance.toLowerCase() : ""] || {}).confirmation == "yes",
    isNo: ({context}) => (grammar[context.lastResult ? context.lastResult?.[0]?.utterance.toLowerCase() : ""] || {}).confirmation == "no",
  }
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
    NoInput: {
      entry: {
        type: "spst.speak",
        params: { utterance: `I can't hear you!` },
      },
      on: { SPEAK_COMPLETE: "Dialogue.hist" },
    },
    Dialogue:{
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
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => {
                    return { lastResult: event.value };
                  })
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                  invoke: "#DM.NoInput"
                },
              },
            },
          },
        },
        StartPrompt: {
            entry: {type: "spst.speak", params: {utterance: "Let's test the ASR! Say a phrase and I will transcribe it and show you the confidence. Say no if you want to stop this test."}},
            on: {SPEAK_COMPLETE: "TestASR"},
        },
        TestASR: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              {
                target: "#DM.Done",
                guard: "isNo",
              },
              {
                target: "SayConfidence",
                guard: ({ context }) => !!context.lastResult,
              },
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { 
                type: "spst.speak", 
                params: { utterance: `Say your phrase.` } 
              },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED:{
                    actions: [assign(({ event }) => {
                      console.log(event.value);
                      return { lastResult: event.value };
                    }),
                  ],
                  },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                  invoke: "#DM.NoInput"
                },
              },
            },
          },
        },
        SayConfidence : {
              entry: { type: "spst.speak", params: ({context}) => ({
              utterance: `I transcribed ${context.lastResult?.[0]?.utterance.toLowerCase() ?? "NOTHING"} with a confidence of ${context.lastResult?.[0]?.confidence.toFixed(2) ?? "N/A"}`
            })},
              on: { SPEAK_COMPLETE: "TestASR" },
        },
    },
  }, 
  Done: {
    entry: [{type: "spst.speak", params: {utterance: "Thank you for testing the ASR with us. Goodbye!"}}],
    on: {
      CLICK: "Dialogue.Greeting",
    },
  },
}
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