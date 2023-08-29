import { createMachine, actions } from "xstate";
import { v4 as uuid } from "uuid";
const { send, assign, sendTo, sendParent, raise } = actions;

// TODO: what should the "resting state" be?
// we need a Finished state when
// cancelled
// transferred

export const stockMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgFV9dZYBXSAYgBUANAfQGVGB5AYQGlWASXbsyAQQByPAKIBtAAwBdRKAAOAe1i4ALrnX4VIAB6IAjAA5TJUwFYAbACYb8p-MfyXAGhABPRABY7GxIAZlMHfwBOB3NI2wjIgF9E7zQsPEJSQWo6CCY2Tl4BMR4ZAAVGSRkFZSQQDS1dfUMTBBsbEJJzf38bcxsAdliByIGbbz8ECztQhwdTSMD-eQXIm2TUjBwCYhJs2gYWDm5+Vh4q6QAZS7FGQS4JGsMGnT0DOtb-WxIOjpc5kLtfwDCaIAaOLpfUxBAa9GyReQhDYgNLbTIkMSYTBgVTaQ4FE4CYSiC5POovJrvUCtewzDqRcyMuymELRUz+UEIXqdcEJSIhQGmAYrZGojK7THY3H445FViMABKknYADFpAqyWpNK9mh9EPZgoyQnZWR1-CEInZOWF5CQBgMQv5LIyBhZYaKtuLSJKcXi8kdCqdzlIrjc7g9NfVtZSWmCHJ1AmEOsKbFFzFbfIgYSR5EMWWMVqnjR70jtSDx0PhsQAbasMFWCCTCAASkYpb1jCH5M2B-njIX6HjmHMzCCGwXs9uHY1h0OSKRA+HUEDghjFZee0Y7eoQAFpOt0QmMQi4vpY7PJIpyGV05gsBg4GayXKYS2jdhQqAcIJvGtvqQE-jWPYlqjH0FispyTrmD8z42I+6Z2GMdj+G+Xp7DkkC-jqVLGIBtoCgypiXg4l7RCEUGMrBCLwQydhIfYqELuu6I+tKP7kluuoAQg5gODMowOnxMT0vGlEwfS8i0YhyFMZspbohWVZgLWWGcX+3F4bxKxdMRJqkemazmBRo7jj8SEPhEM5fHYaFliQAAi+hgNhMY7sRIyhKY0Kpoi8GkSCpndF59oeOmA52JEtnzkAA */
    id: `Stock Machine`,
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
          TX_STOCK_ISSUANCE: {
            target: "Issued",
            actions: ["issue"],
          },
        },
      },
      Issued: {
        on: {
          // not allowing more issuance until first position is accepted
          TX_STOCK_ACCEPTANCE: {
            target: "Accepted",
            actions: ["accept"],
          },
          TX_STOCK_CANCELLATION: {
            target: "Cancelled",
            actions: ["cancel"],
          },
        },
      },
      Accepted: {
        on: {
          TX_STOCK_ISSUANCE: {
            target: "Issued",
            actions: ["issue"],
          },
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
        on: {
          FINISH: {
            target: "Done",
          },
        },
      },
      Done: {
        type: "final",
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

export const parentMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAUCGAnMA7ALgOgEsIAbMAYggHssxCsA3Sga1th0oGMmBZVDgCwI0AkljaosHMAG0ADAF1EoAA6VYBHAWpKQAD0QAWAEwAaEAE9EARgDsNvAYCsAZlkGAHAdlGrsgGyeAL6BZmiYuIQk5ADKACoAggBKsQD6wtHRAKrxAHIAwgCicopIIKrqmtql+ggBeM42jrLesu5W7rI2nmaWCG14Tc2yAJxNzsOd7cEhIFiUEHA6Ydg4OuUaWlg6NQC0fj2Ie8GhGCuRpGtqG1WgNf1Gjl2+zlZGnn6PBwhGRsN4o64PjZvON3MNnNNAkA */
  id: "Parent",
  initial: "ready",
  // aggregating all of the children
  context: {
    childInstances: [],
    activePositions: {},
    activeSecurityIdsByStockClass: {},
  },
  states: {
    ready: {
      on: {
        CREATE_CHILD: {
          actions: assign({
            childInstances: (context, event) => [
              ...context.childInstances,
              event.id, // child name
            ],
          }),
        },
        UPDATE_CONTEXT: assign((context, event) => ({
          activePositions: {
            ...event.activePositions,
            ...context.activePositions,
          },
          activeSecurityIdsByStockClass: {
            ...event.activeSecurityIdsByStockClass,
            ...context.activeSecurityIdsByStockClass,
          },
        })),
      },

      invoke: {
        src: (context, event) => stockMachine, // The child machine
        id: (context, event) => event.id, // Use the event's ID as the service ID
      },
    },
  },
});

const updateContext = (
  context,
  { stakeholder_id, stock_class_id, security_id, quantity, share_price }
) => {
  console.log("Updating Parent Context");
  // Update Active Positions
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

  // Send data to parent
  sendParent({
    type: "UPDATE_CONTEXT",
    activePositions: context.activePositions,
    activeSecurityIdsByStockClass: context.activeSecurityIdsByStockClass,
  });
};
