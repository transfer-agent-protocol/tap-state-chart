import { useMachine } from "@xstate/react";
import { stockMachine } from "./stockMachine";
import { useState } from "react";
import {
  stockIssuanceData,
  stockAcceptanceData,
  stockCancellationData,
} from "./transactions";

const Toggler = () => {
  const [state, send] = useMachine(stockMachine);
  const [quantity, setQuantity] = useState("");
  const [security_id, setSecurityId] = useState("");
  const [stakeholder_id, setStakeholderId] = useState("");
  const [stock_class_id, setStockClassId] = useState("");

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
          placeholder="quantity"
          onChange={(e) => setQuantity(+e.target.value)}
        ></input>
        <input
          value={security_id}
          placeholder="security_id"
          onChange={(e) => setSecurityId(e.target.value)}
        ></input>
        <input
          value={stakeholder_id}
          placeholder="stakeholder_id"
          onChange={(e) => setStakeholderId(e.target.value)}
        ></input>
        <input
          value={stock_class_id}
          placeholder="stock_class_id"
          onChange={(e) => setStockClassId(e.target.value)}
        ></input>
        <button
          onClick={() =>
            send({
              type: "StockIssuance",
              value: {
                ...stockIssuanceData,
                security_id,
                stakeholder_id,
                quantity,
                stock_class_id,
              },
            })
          }
        >
          Issue
        </button>
        <button
          onClick={() =>
            send({
              type: "StockAcceptance",
              value: {
                security_id,
                stakeholder_id,
                ...stockAcceptanceData,
                stock_class_id,
              },
            })
          }
        >
          Accept
        </button>
        <button
          onClick={() =>
            send({
              type: "StockCancellation",
              value: {
                ...stockCancellationData,
                security_id,
                stakeholder_id,
                quantity,
              },
            })
          }
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Toggler;
