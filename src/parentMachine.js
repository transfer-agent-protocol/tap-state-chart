import { createMachine, actions } from "xstate";
import { stockMachine } from "./stockMachine";
import { v4 as uuid } from "uuid";
const { send, assign, sendTo, sendParent, raise } = actions;

// TODO: what should the "resting state" be?
// we need a Finished state when
// cancelled
// transferred

export const parentMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QAUCGAnMA7ALgOk1QgE8BiAFQA0B9AZXIHkBhAaWoElbaBVAQQDkmAUQDaABgC6iUAAcA9rACWORXKzSQAD0QAmAMwBOPGIDsADgCMAVjMG95vRYMmANCGKJrRnToBsNgBYLPR0zKws-AF9ItzRMXAIwIjJuZAARXnIhaiYGfizKcnEpJBB5JRU1DW0EILwDBsamxrM3DwRLPCsxHp0xAN6TczNomJAsOQg4DTjsHA1y5VV1UpqAWl9jHu2d7Z0LNsQN6NiMOcTkhYUlqtXEAx16nQNfMICrP1sxPUOECzNHu9HAEHr49CEwicQLMEoosAA3OQAazhUCYAAtFAAbCBXCrLaqIAL+PAQiy+XwBfYmYIGKy-axmepWRwfHwvMTOUaRIA */
    id: "Parent",
    initial: "ready",
    // aggregating all of the children
    context: {
      childInstances: [],
      activePositions: {},
      activeSecurityIdsByStockClass: {},
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
    states: {
      ready: {
        on: {
          TX_STOCK_ISSUANCE: {
            target: "invokingChild",
            actions: [
              assign({
                childInstances: (context, event) => [
                  ...context.childInstances,
                  event.id, // child name
                ],
              }),
            ],
          },
        },
      },
      invokingChild: {
        invoke: {
          src: stockMachine,
          data: (context, event) => event.value,
          id: "sec-id-1",
        },
        on: {
          UPDATE_CONTEXT: {
            actions: ["update"],
          },
        },
      },
    },
  },
  {
    actions: {
      update: (context, event) => {
        console.log("UPDATING PARENT ", context, "event", event);
        context.activePositions = event.value.activePositions;
        context.activeSecurityIdsByStockClass =
          event.value.activeSecurityIdsByStockClass;
      },
    },
  }
);
