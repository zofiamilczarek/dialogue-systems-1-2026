import { assign, createActor, setup, and, or } from "xstate";
import type { Settings } from "speechstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure";
import type { DMContext, DMEvents, AppointmentState, Entity } from "./types";

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

function getApptFromIntents(entities: Entity[]): AppointmentState {
  const appt: AppointmentState = {}  
  for (const entity of entities) {
    if (entity.category === "date") {
      appt.day = entity.text;
    }
    else if (entity.category === "person") {
      appt.name = entity.text;
    }
    else if (entity.category === "time") {
      appt.time = entity.text;
    }
  }
  return appt;
}

const CELEBRITIES = {
  swift: "Taylor Swift is a famous singer and songwriter, known for songs such as 'Shake it Up'.",
  dicaprio: "Leonardo DiCaprio is a famous actor who played in movies such as 'The Wolf of Wallstreet' and 'Titanic'.",
  sheeran: "Ed Sheeran is a famous singer-songwriter."
}

function getCelebrityFacts(name: string): string {
  name = name.toLowerCase().trim();
  for (const key of Object.keys(CELEBRITIES) as Array<keyof typeof CELEBRITIES>) {
    if (name.includes(key)) {
      return CELEBRITIES[key];
    }
  }
  return "I don't know this celebrity";
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
  // TODO: figure out how to actually access the boolean value
  guards:{
    isYes: ({context}) => {
      let isTrueResolution: boolean = context.interpretation?.entities?.find(e => e.resolutions?.[0].resolutionKind === "BooleanResolution")?.resolutions?.[0].value ?? false;
      let isListkeyYes: boolean = context.interpretation?.entities?.find(e => e.extraInformation?.[0].key === "yes")?.extraInformation?.[0].key === "yes";
      return isTrueResolution || isListkeyYes;
    },
    isNo: ({context}) => !(context.interpretation?.entities?.find(e => e.resolutions?.[0].resolutionKind === "BooleanResolution")?.resolutions?.[0].value ?? true),
  },
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
        params: { utterance: `I don't know how to do that, but I can schedule an appointment for you or tell you something about a celebrity!` },
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
              // Go to information about celebs if it's WhoIsX
              {
                target: "CheckCelebrity",
                guard: ({ context }) => context.interpretation?.topIntent == "WhoIsX",
              },
              // Go to meeting handling if it's a CreateMeeting intent
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
              entry: { type: "spst.speak", params: { utterance: `What would you like to do? I can schedule an appointment for you or tell you something about a celebrity` } },
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
        CheckCelebrity: {
          entry: {
            type: "spst.speak",
            params: ({context}) => ({
                  utterance: getCelebrityFacts(context.interpretation?.entities.find(e => (e.category === "person" || e.category==="celebrity"))?.text ?? "")
              }),
          },
          on: { 
            SPEAK_COMPLETE: 
              {
                actions: assign(({}) => {
                    return { interpretation: null };
                  }),
                target: "#DM.Done",
              } 
          },
        },
        ConfirmMeeting: {
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
                target: "HandleNLU",
                guard: "isNo",
              },
              // If no speech is picked up we go to NoInput
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: "spst.speak", params: ({context}) => ({
              utterance: !!context.appt.time ? `Do you want me to create am appointment with ${context.appt.name} on ${context.appt.day} at ${context.appt.time}?` : `Do you want me to create am appointment with ${context.appt.name} on ${context.appt.day}`
            })},
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ event }) => ({
                    lastResult: event.value,
                    interpretation: event.nluValue,
                  })),
                },
                ASR_NOINPUT: {
                  actions: assign({ lastResult: null }),
                },
              },
            },
          },
        },
        AskMissing: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              // go back to HandleMeeting when you asked for the day/name
              {
                target: "HandleMeeting",
                guard: ({ context }) => !!context.lastResult,
              },
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: 
                "spst.speak", 
                params:  ({context}) => ({
                    utterance: (!context.appt.day) ? "What day do you want to meet?" : "Who do you want to meet?"
                }),
              },
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
        AskTime: {
          initial: "Prompt",
          on: {
            LISTEN_COMPLETE: [
              // go to ConfirmMeeting if either has been specified or the user said yes
              {
                target: "ConfirmMeeting",
                guard: or(['isYes', ({context}) => !!context.appt.time]),
              },
              // {
              //   target: ".ReAsk",
              //   guard: ({ context }) => !!context.lastResult,
              // },
              { target: "#DM.NoInput" },
            ],
          },
          states: {
            Prompt: {
              entry: { type: 
                "spst.speak", 
                params:  {utterance: "Would you like the meeting to last all day?"},
              },
              on: { SPEAK_COMPLETE: "Ask" },
            },
            Ask: {
              entry: { type: "spst.listen" },
              on: {
                RECOGNISED: {
                  actions: assign(({ context, event }) => {
                    return { 
                      lastResult: event.value, 
                      interpretation: event.nluValue, 
                      appt: {
                        ...context.appt,
                        ...getApptFromIntents(event.nluValue?.entities ?? [])
                      } };
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
        HandleMeeting: {
          entry: assign(({context}) => {
              return { appt: {...context.appt, ...getApptFromIntents(context.interpretation?.entities ?? [])} };
          }),
          always: [
            // if day, name and time are there -> confirm to schedule appt
            {
              target: "ConfirmMeeting",
              guard: ({context}) => !!context.appt.day && !!context.appt.name && !!context.appt.time,
            },
            // if time not there -> aks if the meeting is the whole day
            {
              target: "AskTime",
              guard: ({context}) => !!context.appt.day && !!context.appt.name,
            },
            // if day/name not there -> say "you did not specify {day|name}, please specify the name"
            {
              target: "AskMissing",
              guard: ({context}) => !context.appt.day || !context.appt.name,
            },
            {
              target: "HandleNLU",
            }
          ],
          // if none are there -> ask to provide info. extract names from
        },
      },   
    }, 
    Done: {
      entry: [{type: "spst.speak", params: {utterance: "Thank you for using our app!"}}],
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
