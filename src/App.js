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

const machine = createMachine(
  {
    id: "Stock Machine",
    initial: "Exercised",
    states: {
      Exercised: {
        on: {
          StockIssuance: {
            target: "Issued",
          },
        },
      },
      Issued: {
        on: {
          StockAcceptance: {
            target: "Accepted",
          },
        },
      },
      Accepted: {
        on: {
          StockTransfer: {
            target: "Transferred",
          },
        },
      },
      Transferred: {},
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
  },
  {
    actions: {},
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
