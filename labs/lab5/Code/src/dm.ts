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
                guard: 
              },
              {
                target: "ConfirmDayName",
                guard: ({ context }) => isApptComplete(context.appt),
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
        StartPrompt: {
            entry: {type: "spst.speak", params: {utterance: "Let's create an appointment!"}},
            on: {SPEAK_COMPLETE: "WhoPrompt"},
        },
        ReStartPrompt: {
          entry: [
            { type: "resetVars" },
            {
              type: "spst.speak",
              params: {
                utterance: "Let's start again and create a new appointment!"
              }
            }
          ],
          on: {
            SPEAK_COMPLETE: "WhoPrompt"
          }
        },
        // instead of asking for day, name and time separately -> ask once and only re-ask if necessary.
        
        WhoPrompt: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              // 1st we try to go to day prompt if the name is correct
              {
                target: "DayPrompt",
                guard: ({ context }) => !!context.appt?.name,
              },
              // then, if name is not correct, we go to DayPrompt anways
              {
                target: ".WrongName",
                guard: ({ context }) => !!context.lastResult,
              },
              // if no lastResult, go to error handling
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: { utterance: `Who are you meeting with?` } },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            WrongName: {
              entry: { 
                type: "spst.speak", params: ({context}) => ({
                  utterance: `You said ${context.lastResult?.[0]?.utterance ?? "nothing"}, which doesn't contain a name I know. Please give me another name.`
              })
            },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ context, event }) => ({
                    lastResult: event.value,
                    appt: {
                      ...context.appt,
                      name: getName(event.value?.[0]?.utterance ?? ""),
                    },
                  })),
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                },
              },
            },
          },
        },
        DayPrompt: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              {
                target: "IsWholeDay",
                guard: ({ context }) => !!context.appt?.day,
              },
              {
                target: ".WrongDay",
                guard: ({ context }) => !!context.lastResult,
              },
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: { utterance: `On which day is your meeting?` } },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            WrongDay: {
              entry: { 
                type: "spst.speak", params: ({context}) => ({
                  utterance: `You said ${context.lastResult?.[0]?.utterance ?? "nothing"}, which isn't a day of the week. Please give me another day.`
              })},
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ context, event }) => ({
                    lastResult: event.value,
                    appt: {
                      ...context.appt,
                      day: getDay(event.value?.[0]?.utterance ?? ""),
                    },
                  })),
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                },
              },
            },
          },
        },
        IsWholeDay: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              // 1st we try to go to ConfirmDayName if user says yes
              {
                target: "ConfirmDayName",
                guard: "isYes",
              },
              // If they say no we try to go to TimePrompt
              {
                target: "TimePrompt",
                guard: "isNo",
              },
              // If no speech is picked up we go to NoInput
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: { utterance: `Will it take the whole day?` } },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => ({
                    lastResult: event.value,
                  })),
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                },
              },
            },
          },
        },
        TimePrompt: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              {
                target: "ConfirmDayTimeName",
                guard: ({ context }) => !!context.appt?.time,
              },
              {
                target: ".WrongDay",
                guard: ({ context }) => !!context.lastResult,
              },
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: { utterance: `What time is your meeting?` } },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            WrongDay: {
              entry: { 
                type: "spst.speak", params: ({context}) => ({
                  utterance: `You said ${context.lastResult?.[0]?.utterance ?? "nothing"}, which isn't a valid time. Please repeat what time is your meeting.`
              })},
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ context, event }) => ({
                    lastResult: event.value,
                    appt: {
                      ...context.appt,
                      time: getTime(event.value?.[0]?.utterance ?? ""),
                    },
                  })),
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                },
              },
            },
          },
        },
        ConfirmDayName: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              // If the user says yes, we are done
              {
                target: "#DM.Done",
                guard: "isYes",
              },
              // If they say no we start again
              {
                target: "ReStartPrompt",
                guard: "isNo",
              },
              // If no speech is picked up we go to NoInput
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: ({context}) => ({
              utterance: `Do you want me to create am appointment with ${context.appt.name} on ${context.appt.day} the whole day?`
            })},
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => ({
                    lastResult: event.value,
                  })),
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                },
              },
            },
          },
        },
        ConfirmDayTimeName : 
        {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              // If the user says yes, we are done
              {
                target: "#DM.Done",
                guard: "isYes",
              },
              // If they say no we start again
              {
                target: "ReStartPrompt",
                guard: "isNo",
              },
              // If no speech is picked up we go to NoInput
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: ({context}) => ({
              utterance: `Do you want me to create am appointment with ${context.appt.name} on ${context.appt.day} at ${context.appt.time}?`
            })},
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => ({
                    lastResult: event.value,
                  })),
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
