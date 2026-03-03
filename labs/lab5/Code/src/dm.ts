import { assign, createActor, setup } from "xstate";
import type { Settings } from "speechstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure";
import type { DMContext, DMEvents, AppointmentState } from "./types";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://francecentral.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://lab-gusmilczo.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview" /** your Azure CLU prediction URL */,
  key: NLU_KEY /** reference to your Azure CLU key */,
  deploymentName: "appointment" /** your Azure CLU deployment */,
  projectName: "lab5" /** your Azure CLU project name */,
};

const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials,
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
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  bora: { person: "Bora Kara" },
  tal: { person: "Talha Bedir" },
  tom: { person: "Tom Södahl Bladsjö" },
  taylor: {person: "Taylor Swift"},
  ed: {person: "Ed Sheeran"},
  leo: {person: "Leonardo DiCaprio"},
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
};

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance: string) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function isApptComplete(appt: AppointmentState | null) {
  if (!!appt) {
    return false;
  }
  else {
    return (!!appt.name && !!appt.day && !!appt.time);
  }
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
        value: { nlu: true}, // activating NLU
      }),
    "resetVars" : assign(() => ({
            lastResult: null,
            appt: {
              name: undefined,
              day: undefined,
              time: undefined,
            },
            interpretation: null,
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
    interpretation: null,
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
    NoIntent: {
      entry: {
        type: "spst.speak",
        params: { utterance: `I Don't know how to do that, but I can schedule an appointment for you or tell you something about a celebrity!` },
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
                target: "HandleNLU",
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
                    return { lastResult: event.value, interpretation: event.nluValue };
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
        HandleNLU: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              {
                target: "CheckCelebrity",
                guard: ({ context }) => context.interpretation?.topIntent == "WhoIsX",
              },
              {
                target: "HandleMeeting",
                guard: ({ context }) => context.interpretation?.topIntent == "CreateMeeting",
              },
              {
                target: "#DM.NoIntent",
                guard: ({ context }) => !!context.lastResult,
              },
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: { utterance: `What would you like to do?` } },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => {
                    return { lastResult: event.value, interpretation: event.nluValue };
                  })
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                  invoke: "#DM.NoInput"
                },
              },
            },
          },
          // Go to meeting handling if it's a CreateMeeting intent
          // Go to information about celebs if it's WhoIsX
        },
        // instead of asking for day, name and time separately -> ask once and only re-ask if necessary.
        CheckCelebrity: {
          // find the celeb in a list
          // speak info about them
          // say "idk" if we dont know who that is
        },
        HandleMeeting: {
          // if day, name and time are there -> confirm to schedule appt
          // if time not there -> aks if the meeting is the whole day
          // if day/name not there -> say "you did not specify {day|name}, please specify the name"
          // if none are there -> ask to provide info. extract names from
        },
      },   
    }, 
    Done: {
      entry: [{type: "spst.speak", params: {utterance: "Meeting created. Goodbye!"}}],
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
