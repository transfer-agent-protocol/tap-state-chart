import { useMachine } from "@xstate/react";
import { stockMachine } from "./stockMachine";
import { useState } from "react";

const Toggler = () => {
  const [state, send] = useMachine(stockMachine);
  const [stock, setStock] = useState(0);

  console.log("state", state);
  return (
    <div>
      <div>Stock: {state.context.stock}</div>
      <div>Current State: {state.value}</div>
      <input value={stock} onChange={(e) => setStock(+e.target.value)}></input>
      <button onClick={() => send({ type: "StockIssuance", value: stock })}>
        Issue
      </button>
      <button onClick={() => send({ type: "StockCancellation", value: stock })}>
        Cancel
      </button>
    </div>
  );
};

export default Toggler;
