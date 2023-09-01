import { v4 as uuid } from "uuid";
import { actions, createMachine, spawn, stop } from "xstate";
import { stockMachine } from "./stockMachine";
const { assign, raise } = actions;

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
          STOP_CHILD_FOR_CANCELLATION: {
            actions: ["stopChildForCancellation", "respawnSecurityIfNecessary"],
          },
          STOP_CHILD_FOR_TRANSFER: {
            actions: ["stopChildForTransfer", "createTransferee", "respawnSecurityIfNecessary"],
          },
          CHILL: {},
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
      createTransferee: raise((context, event) => {
        const { tempActivePositionForTransferee } = context;
        console.log(" create  transferee with context  ", context);
        console.log(" create  transferee with event  ", event);
        return {
          type: "TX_STOCK_ISSUANCE",
          value: {
            ...tempActivePositionForTransferee,
            stakeholder_id: event.transferee_id,
            quantity: event.quantity,
          },
        };
      }),
      // BUG: in the events tap of the inspector, { TX_STOCK_ISSUANCE } isn't appearing, though logic is working as expected.
      respawnSecurityIfNecessary: raise((context, event) => {
        if (!context.isRespawning) {
          delete context.isRespawning;
          console.log("no respawning necessary");
          return { type: "CHILL" };
        }
        const { temporaryActivePosition, temporarySecurityId } = context;

        delete context.temporaryActivePosition;
        delete context.temporarySecurityId;
        delete context.isRespawning;

        return {
          type: "TX_STOCK_ISSUANCE",
          id: temporarySecurityId,
          value: temporaryActivePosition,
        };
      }),
      stopChildForTransfer: assign((context, event) => {
        const { security_ids, transferor_id, remainingQuantity, quantity, stock_class_id } = event.value;

        const currentActivePosition = context.activePositions[transferor_id][security_ids.at(-1)]; // the last position will be the one that has remaining quantity
        // 1. Setup data to spawn a new child for the transferee
        const transfereeSecurityId = uuid().toString().slice(0, 4);
        const transfereeStakeholderId = uuid().toString().slice(0, 4);

        const transfereeActivePosition = {
          activePositions: {},
          activeSecurityIdsByStockClass: {},
          value: {
            ...currentActivePosition,
            quantity,
            stakeholder_id: transfereeStakeholderId,
            security_id: transfereeSecurityId,
          },
        };
        context.tempActivePositionForTransferee = transfereeActivePosition;

        for (const security_id of security_ids) {
          // 2. Stop the child machine
          stop(security_id);

          // 3. delete the child machine from the context
          delete context.securities[security_id];
          delete context.activePositions[transferor_id][security_id];
          delete context.activeSecurityIdsByStockClass[transferor_id][stock_class_id];
        }

        if (remainingQuantity) {
          // 4. (if applicable), Setup data to spawn new a new child for the transferor if there's remaining quantity
          console.log("remainingQuantity", remainingQuantity);
          const newSecurityId = uuid().toString().slice(0, 4);
          const newActivePosition = {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: {
              ...currentActivePosition,
              quantity: remainingQuantity,
              security_id: newSecurityId,
            },
          };

          context.isRespawning = true;
          context.temporaryActivePosition = newActivePosition;
          context.temporarySecurityId = newSecurityId;
        } else {
          context.isRespawning = false;
        }
      }),
      stopChildForCancellation: assign((context, event) => {
        console.log("stopChildForCancellation", context, event);
        const { security_id, stakeholder_id, remainingQuantity, stock_class_id } = event.value;

        // 1. Stop the child machine
        stop(security_id);

        // 2. delete the child machine from the context
        delete context.securities[security_id];
        delete context.activePositions[stakeholder_id][security_id];
        delete context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id];

        const currentActivePosition = context.activePositions[stakeholder_id][security_id];

        if (remainingQuantity) {
          // 3. Spawn a new child machine if there's remaining quantity
          console.log("remainingQuantity", remainingQuantity);
          const newSecurityId = uuid().toString().slice(0, 4);
          const newActivePosition = {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: {
              ...currentActivePosition,
              quantity: remainingQuantity,
              security_id: newSecurityId,
            },
          };

          context.isRespawning = true;
          context.temporaryActivePosition = newActivePosition;
          context.temporarySecurityId = newSecurityId;
        } else {
          context.isRespawning = false;
        }
      }),
    },
  }
);
