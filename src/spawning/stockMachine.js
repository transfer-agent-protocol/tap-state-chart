import { actions, createMachine } from "xstate";
const { sendParent, raise } = actions;

export const stockMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QGUAuB7AxgawHRoEMA7CAIwE8BiAFQA0B9ZageQGEBpegSWWQFUAggDlWAUQDaABgC6iUAAd0sAJapl6InJAAPRACYArAE5ckgIyGLeyQHZJAZgsGANCHKJ7ADnu4ALJN8ANk8jG09ws29AgF9o1zQsPC5YWABXSBoGJjZOAVYxAAVqYTEpWSQQRRU1DS1dBD1vXDMDQMNXdwQWm1xPSSMQg297EZGzWPiMHFxktIy6RhYOelYS0QAZdYFqLmYhMq0q1XVNCvrGnxa2lzcPa1wjPSNgmwMJkATp2fSITMWc+gAJVE1EBeR2ewOFSONVOoHOvkuLwMvgMNhsgXsgRseg6iDM-V6-UGw1GjnenzwAkwmDA8lQ8yyS04oOEyAAYqJAVCFEpjrUzohAkYfCF0U9zIFfJFcbcEJ49H4zMKDNY9GZXpEKVMqTS6QzfgtsstViINlsIfsZIc+bC6kKbL4ifZQkZJdKFXiGo1etZWiNia9tYlcNTafTGf9lsDWaxLTzKraTvaEOizLhHJ5XoECfYDFcvU9008DK1SwNhfZfLE4iAiOgIHAtJSbdVk4KEABaCw9SQo-y+LPGIdGL2dgymOzl+x6HMhUJ6YPTQgkCit-lwnQebEPAxY2cu8KOUdytHphx6GxmIyqrH2JdJFI-dd2judmwmPu+AcjkderwTp4Zjfp4xiSFKM7VrWlKhnqEYQC+7bwogKKeA84HtHK15OgekjWKSozjNBOq4NQABOxCwAAZmAZFkZAiECshXSSHhzRGKith4cYH72F6BITi6eZ9oYBjgcE97ESGrDELSAA2ckMdCSZMVuCADD0njCpiwQBAEUr-qxvpFoEplmaZkmTCGgJgKgFGYAajGbvUQHphxs6RL4rqNF6dhOpijhot4Qz2JIng1tEQA */
    id: "Stock",
    initial: "Standby",
    context: {
      value: {},
      activePositions: {},
      activeSecurityIdsByStockClass: {},
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
    states: {
      Standby: {
        entry: raise(() => ({ type: "TX_STOCK_ISSUANCE" })),
        on: {
          TX_STOCK_ISSUANCE: {
            target: "Issued",
            actions: ["issue", "sendBackToParent"],
          },
        },
      },
      Issued: {
        on: {
          // not allowing more issuance until first position is accepted
          TX_STOCK_ACCEPTANCE: {
            target: "Accepted",
            actions: ["accept", "sendBackToParent"],
          },
          TX_STOCK_CANCELLATION: {
            target: "Cancelled",
          },
          TX_STOCK_RETRACTION: {
            target: "Retracted",
          },
        },
      },
      Accepted: {
        on: {
          TX_STOCK_TRANSFER: {
            target: "Transferred",
          },
          TX_STOCK_CANCELLATION: {
            target: "Cancelled",
          },
          TX_STOCK_RETRACTION: {
            target: "Retracted",
          },
        },
      },
      Transferred: {
        // type: "final",
        entry: ["stopChild"],
        on: {
          TX_STOCK_REPURCHASE: {
            target: "Repurchased",
          },
        },
      },
      Cancelled: {
        type: "final",
        entry: ["stopChild"],
      },
      Retracted: {
        type: "final",
        entry: ["stopChild"],
      },
      Repurchased: {
        type: "final",
        entry: [],
      },
    },
  },
  {
    actions: {
      issue: (context, event) => updateContext(context, event.value),
      accept: (context, event) => {
        const { security_id, stakeholder_id } = event;
        const activePosition =
          context.activePositions[stakeholder_id][security_id];
        if (!activePosition) {
          console.log("cannot find active position");
          throw new Error("cannot find active position");
        } else {
          activePosition.accepted = true;
        }
      },
      stopChild: sendParent((context, event) => {
        console.log("inside of stop child");
        console.log("with context ", context);
        console.log("with event ", event);
        const { security_id, stakeholder_id, stock_class_id } = event;
        return {
          type: "STOP_CHILD",
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
  const { stakeholder_id, stock_class_id, security_id, quantity, share_price } =
    context.value;

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

  context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id].push(
    security_id
  );
};
