import { useMachine } from "@xstate/react";
import { stockMachine } from "./stockMachine";
import { useState } from "react";
import { stockIssuanceData, stockAcceptanceData } from "./transactions";

const Toggler = () => {
  const [state, send] = useMachine(stockMachine);
  const [quantity, setQuantity] = useState(0);

  console.log("state", state);
  return (
    <div>
      <div>Context:</div>
      <div>
        <pre>{JSON.stringify(state.context, null, 4)}</pre>
      </div>

      <div>Current State: {state.value}</div>
      <div>
        <input
          value={quantity}
          onChange={(e) => setQuantity(+e.target.value)}
        ></input>
        <button
          onClick={() =>
            send({
              type: "StockIssuance",
              value: { ...stockIssuanceData, quantity },
            })
          }
        >
          Issue
        </button>
        <button
          onClick={() =>
            send({ type: "StockAcceptance", value: stockAcceptanceData })
          }
        >
          Accept
        </button>
        <button
          onClick={() => send({ type: "StockCancellation", value: quantity })}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Toggler;
