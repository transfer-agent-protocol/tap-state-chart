import { createMachine, actions } from "xstate";
import { v4 as uuid } from "uuid";

const { sendTo, raise } = actions;

// we probably want to have an "active" state that serves as the "central" one

const updateContext = (
  context,
  { stakeholder_id, stock_class_id, security_id, quantity, share_price }
) => {
  // if active position is empty for this stakeholder, create it
  if (!context.activePositions[stakeholder_id]) {
    context.activePositions[stakeholder_id] = {};
  }
  context.activePositions[stakeholder_id][security_id] = {
    stock_class_id,
    quantity,
    share_price,
    timestamp: new Date().toISOString(),
    accepted: false,
  };

  if (!context.activeSecurityIdsByStockClass[stakeholder_id]) {
    context.activeSecurityIdsByStockClass[stakeholder_id] = {};
  }

  if (!context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id]) {
    context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id] = [];
  }

  context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id].push(
    security_id
  );
};

// TODO: what should the "resting state" be?
export const stockMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QGUAuB7AxgawAQFkBDTACwEsA7MAOgFUKzZYBXSAYjS2wEknnCKmMAG0ADAF1EoAA7pYZVGXQUpIAB6IAjABYArNQCcAJk0AOAOyjTpnQYDM5gGwAaEAE9ERxweqPT200dtHWCjfwBfcNdOHAJicipqXhZ2GOwAQUwhaVQBITFJJBBZeUVlVQ0EbTtTam1RS3NzXW0AmsdzVw8ELx8-AKCQzTDtSOiMWKJSShpM7NRUiZ4+PJEJVRKFJRUiyscG6iNRMMcjo21zEwMurQNtajsDUQNHXSCDJufTMZA0uOnEnMwDlFlwACoAJwEsAAZmAIQUNnItuVdohmnZqKYRronkYjE1TLobj1jHVNDpNE1dKY7DUfn8pglZllgQsIBwlgBhVYAG15hDKFERRU2QoqiFx9zsBKJRns8plphJdkcmK8jk0DU0LSal0iURAFHQEDgqkZ8RmSNK2wlCAAtLojA9dLozEY6fjRJpXiStY4sU8Xm9tB9LAZvoaLQCaPRGCkINaUTtQJV7dLXe7PUcfcT3J4ycEdBrWsMIlGlv9mUk+JAk+K0Qg6aJfM8HLSCUFRHYSfLnUXtCXQuXxlwqzNqECQYnRciG6nEKdzHV-BS7NpNQTRC586T+xSLrZmq69AzK0yJzzBGB+XXZzbUQuENYA6JgsYrLpvbi891dJcsVOJd-z8ddNDPMcL0SSFoThCEITvGQ51tRsPmdc4dCaCM7n6XtCwPIcy1GA0gA */
    id: "Stock Machine",
    initial: "Unissued",
    context: {
      activePositions: {},
      activeSecurityIdsByStockClass: {},
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
    states: {
      Unissued: {
        on: {
          StockIssuance: {
            target: "Issued",
            actions: ["issue"],
          },
        },
      },

      Issued: {
        on: {
          // not allowing more issuance until first position is accepted
          StockAcceptance: {
            target: "Accepted",
            actions: ["accept"],
          },
        },
      },

      Accepted: {
        on: {
          StockIssuance: {
            target: "Issued",
            actions: ["issue"],
          },
          StockTransfer: "Transferred",
          StockCancellation: {
            target: "Cancelled",
            actions: ["cancel"],
          },
        },
      },

      Cancelled: {
        entry: raise({ type: "Reset" }), // hacky: since the cancel action is happening on a transition, it immediately resets when entering the cancel state.
        on: {
          Reset: {
            target: "Unissued",
          },
        },
      },
    },
  },
  {
    actions: {
      // not called anywhere yet
      transfer: (context, event) => {
        console.log("Transfer Action", event);
        const { quantity, stakeholder_id, stock_class_id } = event.value;

        const activeSecurityIds =
          context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id];
        if (!activeSecurityIds || !activeSecurityIds.length) {
          console.log("cannot find active position");
          throw new Error("cannot find active position");
        }

        let currentSum = 0;
        let securityIdsToDelete = [];
        for (let i = 0; i < activeSecurityIds.length; i++) {
          let security_id = activeSecurityIds[i];
          let activePosition =
            context.activePositions[stakeholder_id][security_id];

          currentSum += activePosition.quantity;
          securityIdsToDelete.push(security_id);

          if (quantity === currentSum) {
            console.log("complete transfer");
            delete context.activePositions[stakeholder_id][security_id];
            break;
          } else if (quantity < currentSum) {
            console.log("partial transfer");
            const remainingQuantity = currentSum - quantity;
            console.log("remainingQuantity", remainingQuantity);

            for (let j = 0; j < securityIdsToDelete.length; j++) {
              delete context.activePositions[stakeholder_id][
                securityIdsToDelete[j]
              ];
            }

            updateContext(context, {
              ...event.value,
              security_id: "UPDATED_SECURITY_ID",
              quantity: remainingQuantity,
            });
            break;
          }
        }
      },
      cancel: (context, event, meta) => {
        console.log("Cancel Action", event);

        const { quantity, stakeholder_id, security_id } = event.value;

        const activePosition =
          context.activePositions[stakeholder_id][security_id];

        if (!activePosition) {
          throw new Error("cannot find active position");
        }

        if (quantity === activePosition.quantity) {
          console.log("complete cancellation");
          delete context.activePositions[stakeholder_id][security_id];
        } else if (quantity < activePosition.quantity) {
          console.log("partial cancellation");
          const remainingQuantity = activePosition.quantity - quantity;
          console.log("remainingQuantity", remainingQuantity);

          delete context.activePositions[stakeholder_id][security_id];
          // now we move to the new issuance
          updateContext(context, {
            ...event.value,
            security_id: "UPDATED_SECURITY_ID",
            quantity: remainingQuantity,
            stock_class_id: activePosition.stock_class_id,
          });
        } else {
          throw new Error(
            "cannot cancel more than quantity of the active position"
          );
        }
      },
      issue: (context, event) => updateContext(context, event.value),
      accept: (context, event) => {
        console.log("Accept Action ", event);
        const { security_id, stakeholder_id } = event.value;
        const activePosition =
          context.activePositions[stakeholder_id][security_id];
        if (!activePosition) {
          console.log("cannot find active position");
          throw new Error("cannot find active position");
        } else {
          activePosition.accepted = true;
        }
      },
    },
    services: {},
    guards: {},
    delays: {},
  }
);
