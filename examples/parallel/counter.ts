import { assign, createActor, setup, stateIn, type ActorRef } from "xstate";
import {
  speechstate,
  type Hypothesis,
  type Settings,
  type SpeechStateExternalEvent,
} from "speechstate";
import { KEY } from "./credentials";

interface DMContext {
  spstRef: ActorRef<any, any>;
  spstRef2: ActorRef<any, any>;
  lastResult: Hypothesis[] | null;
  doorA2B2: boolean;
}

const azureCredentials = {
  endpoint:
    "https://swedencentral.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings: Settings = {
  azureCredentials: azureCredentials,
  azureRegion: "swedencentral",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-GB",
  ttsDefaultVoice: "en-US-Ava:DragonHDLatestNeural",
};

export function setupController(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    actor.send({ type: element.id } as MazeEvents);
  });
}

type MazeEvents =
  | SpeechStateExternalEvent
  | { type: "START" }
  | { type: "EXIT" }
  | { type: "R" }
  | { type: "L" }
  | { type: "U" }
  | { type: "D" };

const machine = setup({
  types: {
    context: {} as DMContext,
    events: {} as MazeEvents,
  },
  actions: {
    openDoorA2B2: assign({ doorA2B2: true }),

    /** Using actions to change the parameters of the webpage
     */
    disableButton: ({}, params: { id: string }) =>
      (document.querySelector<HTMLButtonElement>(params.id)!.style =
        "background-color: red;"),
    enableButton: ({}, params: { id: string }) =>
      (document.querySelector<HTMLButtonElement>(params.id)!.disabled = false),
  },
  guards: {
    isDoorA2B2Open: ({ context }) => context.doorA2B2,
  },
}).createMachine({
  context: ({ spawn }) => ({
    doorA2B2: false,
    lastResult: null,

    /** Working with 2 instances of speechstate
     */
    spstRef: spawn(speechstate, { input: settings }),
    spstRef2: spawn(speechstate, { input: settings }),
  }),
  id: "root",
  initial: "MainMenu",
  states: {
    Prepare: {
      on: { ASRTTS_READY: "MainMenu" },
    },
    MainMenu: {
      entry: [
        ({ context }) => context.spstRef.send({ type: "PREPARE" }),
        ({ context }) => context.spstRef2.send({ type: "PREPARE" }),
      ],

      /** For showing how actions for changing the webpage are executed
       */
      on: {
        START: "NewState",
      },

      /** For showing parallel states etc.
       */
      // on: {
      //   START: "Game",
      //   ASRTTS_READY: {
      //     target: "Game",
      //     actions: ({ event }) => console.log(event),
      //   },
      // },
    },
    NewState: {
      entry: [
        { type: "disableButton", params: { id: "#START" } },
        { type: "enableButton", params: { id: "#EXIT" } },
      ],
    },
    Game: {
      type: "parallel",
      on: { EXIT: "MainMenu" },
      states: {
        Assistant: {
          initial: "Wait",
          states: {
            Wait: {
              on: { ASRTTS_READY: "Welcome", START: "Welcome" },
            },
            Welcome: {
              entry: [
                ({ context }) =>
                  context.spstRef.send({
                    type: "SPEAK",
                    value: { utterance: "You are amazing!" },
                  }),
                ({ context }) =>
                  context.spstRef2.send({
                    type: "SPEAK",
                    value: {
                      utterance: "You are awesome!",
                      voice: "en-US-DavisNeural",
                    },
                  }),
              ],

              /** Shared events between parallel states
               */
              // on: {
              // L: {
              //   actions: ({ context }) =>
              //     context.spstRef.send({
              //       type: "SPEAK",
              //       value: { utterance: "You know how to move!" },
              //     }),
              // },
              // },
              always: {
                target: "InRoom",
                /** In-state guards, reference state by ID
                 */
                guard: stateIn("#A2"),
              },
            },
            InRoom: {
              entry: ({ context }) =>
                context.spstRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: "Nice, you are now in new room with a door!",
                  },
                }),
            },
          },
        },
        Maze: {
          initial: "A1",
          states: {
            hist: { type: "history", history: "deep" },
            A2: {
              /** Assigning ids to states
               */
              id: "A2",
              initial: "Open",
              on: {
                D: "A1",
                R: [
                  {
                    target: "B2",
                    guard: "isDoorA2B2Open",
                  },
                  { actions: () => console.log("THE DOOR IS LOCKED") },
                ],
              },
              states: {
                Closed: {
                  on: { D: { target: "Closed" } },
                },
                Open: {
                  after: {
                    5000: {
                      target: "Closed",
                      actions: () => console.log("YOU ARE LOCKED"),
                    },
                  },
                },
              },
            },
            B2: {
              on: { L: "A2", R: "Win" },
            },
            B1: {
              on: {
                L: "A1",
                R: {
                  actions: { type: "openDoorA2B2" },
                },
              },
            },
            A1: {
              on: { U: "A2", R: "B1" },
            },
            Win: {
              entry: () => console.log("YOU WON"),
            },
          },
        },
      },
    },
  },
});

const actor = createActor(machine).start();
console.group("Initial state");
console.log("State value:", actor.getSnapshot().value);
console.log("State context:", actor.getSnapshot().context);

actor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});
