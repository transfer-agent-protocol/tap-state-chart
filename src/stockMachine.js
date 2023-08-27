import { createMachine } from "xstate";

const stockIssuance = {
  StockIssuance: {
    target: "Issued",
    actions: ["issue"],
  },
};

export const stockMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QGUAuB7AxgawAQFkBDTACwEsA7MAOgFUKzZYBXSAYjS2wEknnCKmMAG0ADAF1EoAA7pYZVGXQUpIAB6IAjADYATNQDsADk26ALAFYjJswE4AzAe0AaEAE9Eu7beqnd9o21Re00zO3sAXwjXThwCYnIqal4WdliePgEhMUkkEFl5RWVVDQRdA1FqR217Wu1tTRDtMNcPBEaDagsDMw6jUSsGo10omIw4olJKGhTWCA5x7ABBTCFpVCyRCVUChSUVPNKze21qPQaHAwtup00DVs9bfV7Q88077QsB0ZB0+KmkrM0osAMKbAA24MIRQoOR2cj2xUOiDMBmeBlsFlsBk0RhCFnsDwQZm0RmoRisJnsWPeJh+f0miRoKzWqGBXFmmzheV2MJKiCCnV0ol0gWF5jRmlsRKlZiqtlEtk+zWxFVsRnpi3+TOoLLA63ZOAAKgAnASwABmYBN3JkCL5yIQV3s5NFlgVunKxgsRN0T2oL16BiueICmq42umutW+rZ83SYMEYEh0P2tvy9v2-IQWLl9nKFL9+YcoqJJxdXgaohxFlRwZGPwo6AgcFUDIS03hhSzjoAtBZ9NSLLj-PnhTofe5EF9qNXeo4nLc7A2xhHGVH6IxUhAu4iDqBSr289cR7VPaIJ77-YHK2FTEYzOGJh3AXxILuHQfELVKkFLnjymaYIr2ed4zFvXo3SfPB1ySPUDR3HlMyRL8ED0TozAfd57BJUwKhcKcymvMCcTsK5rksaDIySRMhEhd8kO7FD1EQYNKmOYxGkxY4GgIto7E0LoKQXT4SWpSJol+LVYJoU1zStE0TQYu0mP3FiEGxfRzFCYN1VsEkHxAgMwIg+9HyiCIgA */
    id: "Stock Machine",

    context: {
      stock: 0,
    },

    predictableActionArguments: true,
    preserveActionOrder: true,

    states: {
      Unissued: {
        on: {
          ...stockIssuance,
        },
      },

      Issued: {
        on: {
          ...stockIssuance,
          StockAcceptance: {
            target: "Accepted",
          },
          StockCancellation: {
            target: "Cancelled",
            actions: ["remove"],
          },
        },
      },

      Accepted: {
        on: {
          ...stockIssuance,
          StockTransfer: "Transferred",
          StockCancellation: {
            target: "Cancelled",
            actions: ["remove"],
          },
        },
      },

      Cancelled: {},
      Transferred: {},
    },
  },
  {
    actions: {
      remove: (context, event) => {
        context.stock = context.stock - event.value;
      },
      issue: (context, event, obj) => {
        console.log("event ", event);

        context.stock = context.stock + event.value;
      },
    },
    services: {},
    guards: {},
    delays: {},
  }
);
