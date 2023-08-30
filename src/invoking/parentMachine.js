import { actions, createMachine } from "xstate";
import { stockMachine } from "./stockMachine";

const { assign } = actions;

export const parentMachine = createMachine(
  {
    id: "Parent",
    initial: "ready",
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
            actions: ["updateParentContext"],
          },
        },
      },
    },
  },
  {
    actions: {
      updateParentContext: assign({
        activePositions: (context, event) => ({ ...event.value.activePositions, ...context.activePositions }),
        activeSecurityIdsByStockClass: (context, event) => ({
          ...event.value.activeSecurityIdsByStockClass,
          ...context.activeSecurityIdsByStockClass,
        }),
      }),
    },
  }
);
