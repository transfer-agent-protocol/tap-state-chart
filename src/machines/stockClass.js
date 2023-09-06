import { actions, assign, createMachine } from "xstate";
const { sendParent, raise } = actions;

const stockClassMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QGUAuB7AxgawHRoEMA7CAIwE8BiAFQA0B9ZageQGEBpegSWWQFUAggDlWAUQDaABgC6iUAAd0sAJapl6InJAAPRACZJk3AE4AbAA4A7ABYAzHoCse8+cnHbAGhDlE1y6dxTM2NJa2NjPWNzJwBfGK80LDwuWFgAV0gaBiY2TgFWMQAFamExKVkkEEUVNQ0tXQQHW2NcZwBGPWbO8IdjLx8EW0kHXGtrC2Ne8PM9Sza4hIwcXBT0zLpGFg56VlLRABl9gWouZiFyrWrVdU1KhqaW9u7uyb7vRAc2gLDpz4cw0y2UwLECJZarDIQLKbXL0ABKomocPyJzOF0qV1qt1A92arXMHS6zVe-UQBNG4XCpksths5lMTRBYOSqUh0Jy2wRhT4cNYAAkBMgJDJLkprnU7h88U8iT03gNTHprLgHIZJAZ-LTZuYmUs8AJMJgwPJUOtsltOEjhMgAGKiOHohRirH1RDuFptKzjUx+XqSNrWUkISLKmzTaxtYbRNq2By6pK4A1Gk1mmHbXYiA5HVHnEUY503V0INodZWK0wl0z+-1tJpB6yGQL2cN6QFV2zx5ZJ42mqEbDmcBFW1g5x1VAsSnFuvGemymH2WP0BoMGPStVWGewGSSWSzqzv6w091MD+Gibm8gVCseYwuShDuSy4Qy78wR1vmLX1sK4Zo70JAmYHTzCCRDoBAcBaMyoo1HeU4IAAtKYQYISMlLhI4irmO4O6WAe+CoMQZADE6sGTjovh6PW2GBBuJZvrYjF6Ho+EQpAMHitiFEINYsytLO-yTJI1KMUGny2LgtaGLM-iWDMnr4d2KYQBxLr3q4IySLYpayU4tLyogtgRiYaqznOgKLvh1AAE7ELAABmYDWdZ7H5mRXENMByqPn4YQlp6WkrnuKpqqEAaWMY+GsMQRoADaxa5pGcUWXkmLSvnGP5rieO8PH+Lgi7SXMEazix8SgnquBwmAqC2ZgvaqXB3GpT5YZZYFuVfGuPxRMYYyfoqDjAuVzJVcaaTWZgAAWBCwIl47uSlegBmlNhtfRHUDA4b4FRuBjuAGxhyXEcRAA */
    id: "StockClass",
    initial: "Standby",
    context: {
      value: {},
      pricePerShare: null,
      initialSharesAuthorized: 0,
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
    states: {
      Standby: {
        entry: [raise(() => ({ type: "TX_STOCK_CLASS_SPLIT" }))],
        on: {
          TX_STOCK_CLASS_SPLIT: {
            target: "Splitted",
            actions: ["split", "spawnSecurities"],
          },
        },
      },
      Splitted: {
        type: "final",
        entry: ["sendBackToParent"],
      },
    },
  },
  {
    actions: {
      split: assign((context) => {
        const { numerator, denumerator } = context.splitRatio;
        if (denumerator == 0) throw Error("Cannot have denumerator of value 0");

        const ratio = numerator / denumerator;
        context.pricePerShare = context.quantity * ratio;
        context.initialSharesAuthorized = denumerator;
        context.quantity = denumerator;

        delete context.splitRatio;
        return { ...context };
      }),
      spawnSecurities: sendParent((context, event) => {
        console.log("inside spawnSecurities (stockclass)");
        console.log({ context });
        console.log({ event });
        return {
          type: "SPAWN_SECURITIES",
          value: {
            securities: {}, // This will store references to spawned child machines
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            transactions: [],
            value: { ...context },
          },
        };
      }),

      // do I need to send bakc to the parent?
      _sendBackToParent: sendParent((context, event) => ({
        type: "UPDATE_CONTEXT",
        value: { ...context },
      })),
    },
    services: {},
    guards: {},
    delays: {},
  }
);

export default stockClassMachine;
