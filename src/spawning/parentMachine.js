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
      transactions: [],
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
    states: {
      ready: {
        on: {
          WAITING: {},
          TX_STOCK_ISSUANCE: {
            actions: "spawnSecurity",
          },
          UPDATE_CONTEXT: {
            actions: "updateParentContext",
          },
          STOP_CHILD_FOR_CANCELLATION: {
            actions: ["stopChild", "respawnSecurityIfNecessary"],
          },
          STOP_CHILD_FOR_TRANSFER: {
            actions: ["stopChild"],
          },
          // Only supporting one transfer, not the 1100 problem. This will be a separate helper function because we need multiple issuances and we will aggregate them
          PRE_STOCK_TRANSFER: {
            actions: ["preTransfer", "createTransferee", "respawnSecurityIfNecessary", "createChildTransfer"],
          },
          PRE_STOCK_CANCELLATION: {
            actions: ["preCancel", "respawnSecurityIfNecessary", "createChildCancellation"],
          },
        },
      },
    },
  },
  {
    actions: {
      createChildTransfer: (context, event) => {
        const { security_id } = event;
        const { balance_security_id, resulting_security_ids } = context;

        const securityActor = context.securities[security_id];

        delete context.balance_security_id;
        delete context.resulting_security_ids;

        securityActor.send({
          type: "TX_STOCK_TRANSFER",
          security_id,
          stakeholder_id: event.transferor_id,
          stock_class_id: event.stock_class_id,
          balance_security_id,
          resulting_security_ids,
        });
      },
      createChildCancellation: (context, event) => {
        const { security_id } = event;
        const { balance_security_id } = context;

        delete context.balance_security_id;

        const securityActor = context.securities[security_id];
        securityActor.send({
          type: "TX_STOCK_CANCELLATION",
          security_id,
          stakeholder_id: event.stakeholder_id,
          stock_class_id: event.stock_class_id,
          balance_security_id,
        });
      },
      preCancel: assign((context, event) => {
        const { quantity, stakeholder_id, security_id } = event;

        const activePosition = context.activePositions[stakeholder_id][security_id];

        if (!activePosition) {
          throw new Error("cannot find active position");
        }

        if (quantity === activePosition.quantity) {
          console.log("complete cancellation");
          context.isRespawning = false;
          context.balance_security_id = ""; // no balance
        } else if (quantity < activePosition.quantity) {
          console.log("partial cancellation");

          const remainingQuantity = activePosition.quantity - quantity;
          console.log("remainingQuantity", remainingQuantity);
          // save data to context if we get here.
          const spawningSecurityId = uuid().toString().slice(0, 4);
          const spawningActivePosition = {
            ...activePosition,
            quantity: remainingQuantity,
            security_id: spawningSecurityId,
            stakeholder_id,
          };

          context.balance_security_id = spawningSecurityId;

          // respawning
          context.isRespawning = true;
          context.respawningActivePosition = spawningActivePosition;
          context.respawningSecurityId = spawningSecurityId;
        } else {
          throw new Error("cannot cancel more than quantity of the active position");
        }
      }),
      preTransfer: assign((context, event) => {
        console.log("Transfer Action in Parent", event);
        const { quantity, transferor_id, transferee_id, security_id, stock_class_id } = event;

        console.log("transferor ", transferor_id, " transferee ", transferee_id, " stock class ", stock_class_id);

        //TODO: check active position exists

        const activePosition = context.activePositions[transferor_id][security_id];

        if (quantity > activePosition.quantity) {
          throw new Error("cannot transfer more than quantity of the active position");
        }
        if (quantity === activePosition.quantity) {
          console.log("complete transfer");
          context.isRespawning = false;
          context.balance_security_id = "";
        } else if (quantity < activePosition.quantity) {
          console.log("partial transfer");

          const remainingQuantity = activePosition.quantity - quantity;

          console.log("remainingQuantity", remainingQuantity);
          // save data to context if we get here.
          const spawningSecurityId = uuid().toString().slice(0, 4);
          const spawningActivePosition = {
            ...activePosition,
            quantity: remainingQuantity,
            security_id: spawningSecurityId,
            stakeholder_id: transferor_id,
          };

          // respawning
          context.isRespawning = true;
          context.respawningActivePosition = spawningActivePosition;
          context.respawningSecurityId = spawningSecurityId;
          context.balance_security_id = spawningSecurityId;
        }

        // setting up for transferee issuance.
        const transfereeSecurityId = uuid().toString().slice(0, 4);
        const transfereeActivePosition = {
          // placeholder for the children since creating a new machine with context deletes the context of the children
          ...activePosition,
          quantity,
          security_id: transfereeSecurityId,
        };

        context.transfereeSecurityId = transfereeSecurityId;
        context.transfereeActivePosition = transfereeActivePosition;
      }),
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
      // BUG: in the events tap of the inspector, { TX_STOCK_ISSUANCE } isn't appearing, though new child is created as expected.
      // I think it's because of how "raise" handles event
      // potentially refactor into "pre create" and "TX_STOCK_ISSUANCE" in child machine similar to transfer
      createTransferee: raise((context, event) => {
        const { transfereeSecurityId, transfereeActivePosition } = context;
        const { quantity, transferee_id } = event;
        console.log(" create  transferee with context  ", context);

        console.log("transferee_id", transferee_id);

        const activePosition = transfereeActivePosition;
        const securityId = transfereeSecurityId;

        console.log("active position inside of transferee ", activePosition);

        delete context.transfereeSecurityId;
        delete context.transfereeActivePosition;

        context.resulting_security_ids = [securityId];

        return {
          type: "TX_STOCK_ISSUANCE",
          id: securityId,
          value: {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: {
              ...activePosition,
              security_id: securityId,
              stakeholder_id: transferee_id,
              quantity,
              // stock_class_id,
            },
          },
        };
      }),
      // BUG: in the events tap of the inspector, { TX_STOCK_ISSUANCE } isn't appearing, though logic is working as expected.
      respawnSecurityIfNecessary: raise((context, event) => {
        if (!context.isRespawning) {
          delete context.isRespawning;
          console.log("no respawning necessary");
          return { type: "WAITING" };
        }
        const { respawningActivePosition, respawningSecurityId } = context;

        delete context.respawningActivePosition;
        delete context.respawningSecurityId;
        delete context.isRespawning;

        return {
          type: "TX_STOCK_ISSUANCE",
          id: respawningSecurityId,
          value: {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: respawningActivePosition,
          },
        };
      }),
      stopChild: assign((context, event) => {
        const { security_id, stakeholder_id, stock_class_id } = event.value;

        // delete adam entirely
        delete context.securities[security_id];
        delete context.activePositions[stakeholder_id][security_id];
        delete context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id];

        stop(security_id);
      }),
    },
  }
);
