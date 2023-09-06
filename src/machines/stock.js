import { updateContext } from "../helpers";
import { actions, createMachine } from "xstate";
const { sendParent, raise } = actions;

const stockMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QGUAuB7AxgawHRoEMA7CAIwE8BiAFQA0B9ZageQGEBpegSWWQFUAggDlWAUQDaABgC6iUAAd0sAJapl6InJAAPRACZJk3AE4AbAA4A7ABYAzHoCse8+cnHbAGhDlE1y6dxTM2NJa2NjPWNzJwBfGK80LDwuWFgAV0gaBiY2TgFWMQAFamExKVkkEEUVNQ0tXQQHW2NcZwBGPWbO8IdjLx8EW0kHXGtrC2Ne8PM9Sza4hIwcXBT0zLpGFg56VlLRABl9gWouZiFyrWrVdU1KhqaW9u7uyb7vRAc2gLDpz4cw0y2UwLECJZarDIQLKbXL0ABKomocPyJzOF0qV1qt1A92arXMHS6zVe-UQBNG4XCpksths5lMTRBYOSqUh0Jy2wRhT4cNYAAkBMgJDJLkprnU7h88U8iT03gNTHprLgHIZJAZ-LTZuYmUs8AJMJgwPJUOtsltOEjhMgAGKiOHohRirH1RDuFptKzjUx+XqSNrWUkISLKmzTaxtYbRNq2By6pK4A1Gk1mmHbXYiA5HVHnEUY503V0INodZWK0wl0z+-1tJpB6yGQL2cN6QFV2zx5ZJ42mqEbDmcBFW1g5x1VAsSnFuvGemymH2WP0BoMGPStVWGewGSSWSzqzv6w091MD+Gibm8gVCseYwuShDuSy4Qy78wR1vmLX1sK4Zo70JAmYHTzCCRDoBAcBaMyoo1HeU4IAAtKYQYISMlLhI4irmO4O6WAe+CoMQZADE6sGTjovh6PW2GBBuJZvrYjF6Ho+EQpAMHitiFEINYsytLO-yTJI1KMUGny2LgtaGLM-iWDMnr4d2KYQBxLr3q4IySLYpayU4tLyogtgRiYaqznOgKLvh1AAE7ELAABmYDWdZ7H5mRXENMByqPn4YQlp6WkrnuKpqqEAaWMY+GsMQRoADaxa5pGcUWXkmLSvnGP5rieO8PH+Lgi7SXMEazix8SgnquBwmAqC2ZgvaqXB3GpT5YZZYFuVfGuPxRMYYyfoqDjAuVzJVcaaTWZgAAWBCwIl47uSlegBmlNhtfRHUDA4b4FRuBjuAGxhyXEcRAA */
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
        entry: [raise(() => ({ type: "TX_STOCK_ISSUANCE" }))],
        on: {
          TX_STOCK_ISSUANCE: {
            target: "Issued",
            actions: ["issue", "sendBackToParent"],
          },
        },
      },
      Issued: {
        on: {
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
          TX_STOCK_REPURCHASE: {
            target: "Repurchased",
          },
          TX_STOCK_REISSUE: {
            target: "Reissued",
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
          TX_STOCK_REPURCHASE: {
            target: "Repurchased",
          },
          TX_STOCK_REISSUE: {
            target: "Reissued",
          },
        },
      },
      Transferred: {
        type: "final",
        entry: ["stopChild"],
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
        entry: ["stopChild"],
      },
      Reissued: {
        type: "final",
        entry: ["stopChild"],
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

export default stockMachine;
