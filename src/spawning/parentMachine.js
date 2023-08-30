import { createMachine, spawn, actions } from "xstate";
import { stockMachine } from "./stockMachine";
const { assign } = actions;

export const parentMachine = createMachine(
  {
    id: "Parent",
    initial: "ready",
    context: {
      securities: {}, // This will store references to spawned child machines
      activePositions: {},
      activeSecurityIdsByStockClass: {},
    },
    states: {
      ready: {
        on: {
          TX_STOCK_ISSUANCE: {
            actions: "spawnSecurity",
          },
          UPDATE_CONTEXT: {
            actions: "updateParentContext",
          },
        },
      },
    },
  },
  {
    actions: {
      spawnSecurity: assign((context, event) => {
        const securityId = event.id;
        const newSecurity = spawn(stockMachine.withContext(event.value), securityId);
        return {
          securities: {
            ...context.securities,
            [securityId]: newSecurity,
          },
        };
      }),
      // TODO: this spread operator isn't working
      updateParentContext: assign({
        activePositions: (context, event) => {
          console.log("context to update parent ", context, "and event ", event);
          return {
            ...context.activePositions,
            ...event.value.activePositions,
          };
        },
        activeSecurityIdsByStockClass: (context, event) => ({
          ...event.value.activeSecurityIdsByStockClass,
          ...context.activeSecurityIdsByStockClass,
        }),
      }),
    },
  }
);
