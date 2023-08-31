import { actions, createMachine } from "xstate";
const { sendParent } = actions;

export const stockMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5SzAYwLQEsLoIwDoBJWWAV0gGIAVADQH0BlKgeQGEBpOgQVdYFEAClS4A5fgG0ADAF1EoAA4B7WJgAumRQDs5IAB6IAzACYArPgAsADgBskgwHYj96+YMuDAGhABPRLkv2+ACcBkGWJkEmRqFB5iEAvvFeKBjYeEQk5BDU9ExsnKyi-AAyxVxUhMwiUrJIIEoq6lo6+gjGZla2Dk7u7l6+CEaxFpKSJia4ofYBlm6JyWhYOARcqKhg8qqUtIwsHHRUAEqiDABifIc1Og1qGtp1rW6WI5KT9rgmkkbWbv2IlgRzPYgrhrM5PrhIeYTPMQCklulVutNttcnsCkU+KVypVqjJrspbs0Hoh7CZAkF7JJYlExhMjLg-gggpJ8AYTOZTLNXEY7NNYfC0gRWABDTTrAA2Esop0IIkIDAAElc6jcmvdQK1ISF8KZJED9eTcNSTEzcEZzPhXuTJNNJJYwrhXIkkiBNIoIHAdILlgTGncWoh0NYmcGBYshRkyJA-USNXpEJymUFrPhrBNwpZvmSDM7XT7EWsNlsILH1YGENZecEfrh7M4hm5-GbQRYIgZjLz7dZwkZw6llvhReKwFKY6rCeWSQhjSYDBYrPbxiZLK4yWaLfgIZIe3P9f5rNZ+wiCAARLRgMsB6eTVuvaY9i0MjlGDfz40OKvm6KxOIu+JAA */
    id: "Stock",
    initial: "Issued",
    context: {
      value: {},
      activePositions: {},
      activeSecurityIdsByStockClass: {},
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
    states: {
      Issued: {
        entry: ["issue", "sendBackToParent"],
        on: {
          // not allowing more issuance until first position is accepted
          TX_STOCK_ACCEPTANCE: {
            target: "Accepted",
            actions: ["accept", "sendBackToParent"],
          },
          TX_STOCK_CANCELLATION: {
            target: "Cancelled",
            actions: ["cancel"],
          },
        },
      },
      Accepted: {
        on: {
          TX_STOCK_TRANSFER: {
            target: "Issued",
            actions: ["transfer"],
          },
          TX_STOCK_CANCELLATION: {
            target: "Cancelled",
            actions: ["cancel"],
          },
        },
      },
      Cancelled: {
        type: "final",
        entry: ["stopChild"],
      },
    },
  },
  {
    actions: {
      // not called anywhere yet
      transfer: (context, event) => {
        console.log("Transfer Action", event);
        const { quantity, stakeholder_id, stock_class_id } = event.value;

        const activeSecurityIds = context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id];
        if (!activeSecurityIds || !activeSecurityIds.length) {
          console.log("cannot find active position");
          throw new Error("cannot find active position");
        }

        let currentSum = 0;
        let securityIdsToDelete = [];
        for (let i = 0; i < activeSecurityIds.length; i++) {
          let security_id = activeSecurityIds[i];
          let activePosition = context.activePositions[stakeholder_id][security_id];

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
              delete context.activePositions[stakeholder_id][securityIdsToDelete[j]];
            }

            // updateContext(context, {
            //   ...event.value,
            //   security_id: "UPDATED_SECURITY_ID",
            //   quantity: remainingQuantity,
            // });
            break;
          }
        }
      },
      stopChild: sendParent((context, event) => {
        return {
          type: "STOP_CHILD",
          value: {
            security_id: event.security_id,
            stakeholder_id: event.stakeholder_id,
            remainingQuantity: context.activePositions[event.stakeholder_id][event.security_id].quantity - event.quantity,
            stock_class_id: context.activePositions[event.stakeholder_id][event.security_id].stock_class_id,
          },
        };
      }),
      cancel: (context, event, meta) => {
        const { quantity, stakeholder_id, security_id } = event;

        const activePosition = context.activePositions[stakeholder_id][security_id];

        if (!activePosition) {
          throw new Error("cannot find active position");
        }

        if (quantity === activePosition.quantity) {
          console.log("complete cancellation");
        } else if (quantity < activePosition.quantity) {
          console.log("partial cancellation");
        } else {
          throw new Error("cannot cancel more than quantity of the active position");
        }
      },
      issue: (context, event) => updateContext(context, event.value),
      accept: (context, event) => {
        const { security_id, stakeholder_id } = event;
        const activePosition = context.activePositions[stakeholder_id][security_id];
        if (!activePosition) {
          console.log("cannot find active position");
          throw new Error("cannot find active position");
        } else {
          activePosition.accepted = true;
        }
      },
      sendBackToParent: sendParent((context, event) => ({
        type: "UPDATE_CONTEXT",
        value: {
          activePositions: context.activePositions,
          activeSecurityIdsByStockClass: context.activeSecurityIdsByStockClass,
        },
      })),
    },
    services: {},
    guards: {},
    delays: {},
  }
);

const updateContext = (context, _) => {
  const { stakeholder_id, stock_class_id, security_id, quantity, share_price } = context.value;

  //Update Active Positions
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

  // Update Security ID indexer
  if (!context.activeSecurityIdsByStockClass[stakeholder_id]) {
    context.activeSecurityIdsByStockClass[stakeholder_id] = {};
  }

  if (!context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id]) {
    context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id] = [];
  }

  context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id].push(security_id);
};
