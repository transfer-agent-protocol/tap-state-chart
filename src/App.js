import { useMachine } from "@xstate/react";
import { createMachine } from "xstate";

const toggleMachine = createMachine({
  id: "toggle",
  initial: "inactive",
  states: {
    inactive: {
      on: { TOGGLE: "active" },
    },
    active: {
      on: { TOGGLE: "inactive" },
    },
  },
});

// Created per Stakeholder
const machine = createMachine(
  {
    id: "Stock Machine",
    context: {
      stock: 0,
    },
    initial: "Exercised",
    states: {
      Exercised: {
        on: {
          StockIssuance: {
            target: "Issued",
            value: {
              stock: 100, // it would be a dynamic input
            },
          },
        },
      },
      Issued: {
        on: {
          StockAcceptance: {
            target: "Accepted",
          },
          StockCancellation: {
            target: "Cancelled",
            actions: ["unissueStock"],
          },
        },
      },
      Accepted: {
        on: {
          StockTransfer: "Transferred",
          StockCancellation: {
            target: "Cancelled",
            actions: ["unissueStock"],
          },
        },
      },
      Transferred: {},
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
  },
  {
    actions: {
      unissueStock: (context, event) => {
        console.log("unissueStock");
        // reset state
        context.stock = 0;
      },
    },
    services: {},
    guards: {},
    delays: {},
  }
);

const Toggler = () => {
  const [state, send] = useMachine(toggleMachine);

  return (
    <button onClick={() => send("TOGGLE")}>
      {state.value === "inactive"
        ? "Click to activate"
        : "Active! Click to deactivate"}
    </button>
  );
};

export default Toggler;
