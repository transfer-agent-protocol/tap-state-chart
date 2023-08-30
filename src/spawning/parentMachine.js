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

          const updatedActivePositions = { ...context.activePositions };

          for (const stakeholderId in event.value.activePositions) {
            if (updatedActivePositions[stakeholderId]) {
              // If the stakeholderId already exists in the context, merge the securities
              updatedActivePositions[stakeholderId] = {
                ...updatedActivePositions[stakeholderId],
                ...event.value.activePositions[stakeholderId],
              };
            } else {
              // If the stakeholderId doesn't exist in the context, just add it
              updatedActivePositions[stakeholderId] = event.value.activePositions[stakeholderId];
            }
          }

          return updatedActivePositions;
        },
        activeSecurityIdsByStockClass: (context, event) => {
          const updatedSecurityIdsByStockClass = { ...context.activeSecurityIdsByStockClass };

          for (const stakeholderId in event.value.activeSecurityIdsByStockClass) {
            if (updatedSecurityIdsByStockClass[stakeholderId]) {
              // If the stakeholderId already exists in the context, merge the stock classes
              for (const stockClassId in event.value.activeSecurityIdsByStockClass[stakeholderId]) {
                if (updatedSecurityIdsByStockClass[stakeholderId][stockClassId]) {
                  // Merge the security IDs arrays
                  updatedSecurityIdsByStockClass[stakeholderId][stockClassId] = [
                    ...new Set([
                      ...updatedSecurityIdsByStockClass[stakeholderId][stockClassId],
                      ...event.value.activeSecurityIdsByStockClass[stakeholderId][stockClassId],
                    ]),
                  ];
                } else {
                  // If the stockClassId doesn't exist in the context for this stakeholder, just add it
                  updatedSecurityIdsByStockClass[stakeholderId][stockClassId] =
                    event.value.activeSecurityIdsByStockClass[stakeholderId][stockClassId];
                }
              }
            } else {
              // If the stakeholderId doesn't exist in the context, just add it
              updatedSecurityIdsByStockClass[stakeholderId] = event.value.activeSecurityIdsByStockClass[stakeholderId];
            }
          }

          return updatedSecurityIdsByStockClass;
        },
      }),
    },
  }
);
