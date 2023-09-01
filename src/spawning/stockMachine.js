import { actions, createMachine } from "xstate";
const { sendParent } = actions;

export const stockMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QGUAuB7AxgawHQElZYBXSAYgBUANAfWQoHkBhAaRoEEmmBRABQvYA5HgG0ADAF1EoAA7pYAS1QL0AO2kgAHogBMADgDMuAIwBWAGw7TAGhABPRGYDsuPWICce96cMG-f4wBfQNs0LDxCEnJqOkZWGiYhHgAZZPYKfAZBcSkkEDlFZTUNbQR9IzNLG3tEAx0xXHcdd3M9J1Ng0IwcXHZMTDAZVGjaemY2CgAlIWQAMW5JnI0CpRV1PNLzdyMvJydmsWNzABZjPR1bBwRz3FOt03qdY3azzpAwnr6BoZHY8YSktxUulMtlJMt5KtihtEOYnMdXGIDO4nO5DiczhcamV9K56hY-B42h03qp0BA4BoPtgIYU1iVEABacyXRy3QxuczGbnHLzeY7mN7UghEUgQWlQ9agUrHLFXfTuXBifbuI7mdUa8wGIXdPBfQbDcV5FZFKVaRCmXmNMRVVkIYzuBE6LVieq+fwGIIhd663AUABOAENVLAAGZgf3+yAS00M+1iV0mR2mZWu0wo7Z24xiUy4ZEGFMPUwp9WGHXhXBMYMDAA2NejxshsZhCE8Lj0Wy1rTExx7JztBgTeOaas16u1wUCQA */
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
            target: "Transferred",
            actions: ["transfer"],
          },
          TX_STOCK_CANCELLATION: {
            target: "Cancelled",
            actions: ["cancel"],
          },
        },
      },
      Transferred: {
        type: "final",
        entry: ["stopChildTransferred"],
      },
      Cancelled: {
        type: "final",
        entry: ["stopChildCancelled"],
      },
    },
  },
  {
    actions: {
      transfer: (context, event) => {
        console.log("Transfer Action", event);
        const { quantity, transferor_id, transferee_id, stock_class_id } = event;

        console.log("transferor ", transferor_id, " transferee ", transferee_id, " stock class ", stock_class_id);

        const activeSecurityIds = context.activeSecurityIdsByStockClass[transferor_id][stock_class_id];
        console.log("activeSecurityIds", activeSecurityIds);

        if (!activeSecurityIds || !activeSecurityIds.length) {
          console.log("cannot find active position");
          throw new Error("cannot find active position");
        }

        let currentSum = 0;
        let securityIdsToDelete = [];

        // Go through the active positions for that stock class
        for (let i = 0; i < activeSecurityIds.length; i++) {
          let security_id = activeSecurityIds[i];
          let activePosition = context.activePositions[transferor_id][security_id];

          // keep a running tally on the sum of the quantities
          currentSum += activePosition.quantity;
          // keep track of the securities IDs used to get the right sum
          securityIdsToDelete.push(security_id);

          if (quantity === currentSum) {
            console.log("complete transfer");

            break;
          } else if (quantity < currentSum) {
            console.log("partial transfer");

            const remainingQuantity = currentSum - quantity;
            console.log("remainingQuantity", remainingQuantity);
            break;
          }
        }

        if (quantity > currentSum) {
          throw new Error("cannot transfer more than quantity of the active position");
        }

        context.temporarySecurityIdsToDelete = securityIdsToDelete;
        context.remainingQuantity = quantity - currentSum;
        context.transferee_id = transferee_id;

        // return securityIdsToDelete + remainingQuantity (if partial exist)
      },
      stopChildTransferred: sendParent((context, event) => {
        return {
          type: "STOP_CHILD_FOR_TRANSFER",
          value: {
            security_ids: context.temporarySecurityIdsToDelete,
            transferee_id: event.transferee_id,
            transferor_id: event.transferor_id,
            remainingQuantity: context.activePositions[event.transferor_id][event.security_id].quantity - event.quantity,
            stock_class_id: context.activePositions[event.transferor_id][event.security_id].stock_class_id,
          },
        };
      }),
      stopChildCancelled: sendParent((context, event) => {
        return {
          type: "STOP_CHILD_FOR_CANCELLATION",
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
