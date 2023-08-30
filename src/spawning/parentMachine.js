import { v4 as uuid } from "uuid";
import { actions, createMachine, spawn, stop } from "xstate";
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
    predictableActionArguments: true,
    preserveActionOrder: true,
    states: {
      ready: {
        on: {
          TX_STOCK_ISSUANCE: {
            actions: "spawnSecurity",
          },
          UPDATE_CONTEXT: {
            actions: "updateParentContext",
          },
          STOP_CHILD: {
            actions: ["stopChild"],
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
      stopChild: assign((context, event) => {
        const { security_id, stakeholder_id, remainingQuantity, stock_class_id } = event.value;

        if (remainingQuantity) {
          console.log("remainingQuantity", remainingQuantity);
          const newSecurityId = uuid().toString().slice(0, 4);
          const newActivePosition = {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: {
              ...context.activePositions[stakeholder_id][security_id],
              quantity: remainingQuantity,
              security_id: newSecurityId,
              stakeholder_id,
            },
          };
          console.log("new activePosition ", newActivePosition);
          const newSecurity = spawn(stockMachine.withContext(newActivePosition), newSecurityId);
          console.log("here 2");
          context.securities = {
            ...context.securities,
            [newSecurityId]: newSecurity,
          };
        }

        stop(security_id);
        delete context.securities[security_id];
        delete context.activePositions[stakeholder_id][security_id];
        delete context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id];
      }),
    },
  }
);
