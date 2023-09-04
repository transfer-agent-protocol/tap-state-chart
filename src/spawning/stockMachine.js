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
      cancel: (context, event) => {
        console.log("inside of cancel for child");
        console.log("with context ", context);
      },
      transfer: (context, event) => {
        console.log("inside of transfer for child ");
        console.log("with context ", context);
        console.log("with event ", event);
        // nothing triggered right now.
      },
      stopChildTransferred: sendParent((context, event) => {
        console.log("inside of stopChildTransferred");
        console.log("with context ", context);
        console.log("with event ", event);
        const { security_id, stakeholder_id, stock_class_id } = event;
        return {
          type: "STOP_CHILD_FOR_TRANSFER",
          value: {
            security_id,
            stakeholder_id,
            stock_class_id,
          },
        };
      }),
      stopChildCancelled: sendParent((context, event) => {
        console.log("inside of stop child cancelled");
        console.log("with context ", context);
        console.log("with event ", event);
        const { security_id, stakeholder_id, stock_class_id } = event;
        return {
          type: "STOP_CHILD_FOR_CANCELLATION",
          value: {
            security_id,
            stakeholder_id,
            stock_class_id,
          },
        };
      }),
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
  console.log("context  ", context);
  console.log("context inside of updateContext ", context);
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
