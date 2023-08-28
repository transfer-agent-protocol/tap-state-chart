import { createMachine } from "xstate";
import { v4 as uuid } from "uuid";

// TODO: what should the "resting state" be?
export const stockMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QGUAuB7AxgawAQFkBDTACwEsA7MAOgFUKzZYBXSAYjS2wEknnCKmMAG0ADAF1EoAA7pYZVGXQUpIAB6IAjABYArNQCcAJk0AOAOyjTpnQYDM5gGwAaEAE9ERxweqPT200dtHWCjfwBfcNdOHAJicipqXhZ2GOwAQUwhaVQBITFJJBBZeUVlVQ0EbTtTam1RS3NzXW0AmsdzVw8ELx8-AKCQzTDtSOiMWKJSShpk1ggOCewAYTywABt1wjKKAtUShSUVIsrtcyM68wNdA3MzO01dOy7EbT9qU11rTTsbzTNNGMQGk4tNEplsqhUks5ms9kUDjsKohHA1qEZRGFHBijGcTAYXghNAZtNQ7AZRAZHLogrdLAZTECQVMEjQIWActCuAAVABOAlgADMwLz4TI5IdyidEM07B8RjdMUYmp9CUZjHV-sEml87DUmUtQazqOzOQs0qtBBstjsxcUJUjpQgbqS7MrPuq3fYwoS7I45V5HJoGo8zk0jJEoiAKOgIHBVMz4jN9g6jsiEABaXQXX66MxGPVGDGaamE4OOD4Uqk07R0ymMqOJsE0eiMFIQFOlNNOjOu3R50wFt3F0vuTwa4I6QOtYYRRuGlkzJJ8SCdyXHUCVPWiXyUhymN1OerPMc9Cda6ehOfjLhGpemqEdhGpqWblHKur+f52N7DSwuU91QuSczlsZp+z0A1b0XRJLSETZV2fLtX3UGVLDqfcfmuaogwA7pa00agvieJpqTeX47CgyYk0SPkBWFXleUQ8VkI3VCEFuC5cR0JoGRJfo1XPKdHCCK9RkjIA */
    id: "Stock Machine",
    initial: "Unissued",
    context: {
      activePositions: {
        // security_id:
        "": {
          stock_class_id: "",
          quantity: 0,
          share_price: {
            currency: "",
            amount: "",
          },
          timestamp: "",
          accepted: false,
        },
      },
      security_ids: [],
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
          StockCancellation: {
            target: "Cancelled",
            actions: ["cancel"],
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
      Cancelled: {},
      Transferred: {},
    },
  },
  {
    actions: {
      cancel: (context, event) => {
        const activePosition = context.activePositions[event.value.security_id];
        if (!activePosition) {
          console.log("cannot find active position");
          throw new Error("cannot find active position");
        }
        if (activePosition.quantity < event.value.quantity) {
          console.log("cannot cancel more than issued");
          throw new Error("cannot cancel more than issued");
        }
        // complete cancellation
        if (activePosition.quantity === event.value.quantity) {
          delete context.activePositions[event.value.security_id];

          // partial cancellation
        } else if (activePosition.quantity > event.value.quantity) {
          const remainingQuantity =
            activePosition.quantity - event.value.quantity;
          console.log("remainingQuantity", remainingQuantity);
          const newSecurityId = uuid();
          context.activePositions[newSecurityId] = {
            quantity: remainingQuantity,
            timestamp: new Date().toISOString(),
            ...activePosition,
          };
        }
      },
      issue: (context, event, obj) => {
        console.log("event ", event);

        context.activePositions[event.value.security_id] = {
          stock_class_id: event.value.stock_class_id,
          quantity: event.value.quantity,
          share_price: event.value.share_price,
          timestamp: new Date().toISOString(),
          accepted: false,
        };
      },
      accept: (context, event) => {
        const activePosition = context.activePositions[event.value.security_id];
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
