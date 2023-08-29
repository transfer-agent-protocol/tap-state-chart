import { useMachine } from "@xstate/react";
import { parentMachine, stockMachine } from "./stockMachineInstances";
import { v4 as uuid } from "uuid";
import { useState } from "react";
import {
  stockIssuanceData,
  stockAcceptanceData,
  stockCancellationData,
} from "./transactions";

const Toggler = () => {
  const [state, send] = useMachine(parentMachine);

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

      <div>Current State of Parent: {state.value}</div>
      {state.context.childInstances.length && (
        <div>Current State of Child: {}</div>
      )}

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
            send([
              { type: "CREATE_CHILD", id: security_id },
              {
                type: "TX_STOCK_ISSUANCE",
                value: {
                  ...stockIssuanceData,
                  security_id,
                  stakeholder_id,
                  quantity,
                  stock_class_id,
                },
                to: security_id,
              },
            ])
          }
        >
          Issue
        </button>
        <button
          onClick={() =>
            send({
              type: "TX_STOCK_ACCEPTANCE",
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
              type: "TX_STOCK_CANCELLATION",
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
