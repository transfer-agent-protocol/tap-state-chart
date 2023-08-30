import { useMachine } from "@xstate/react";
import { useState } from "react";
// import { parentMachine } from "./invoking/parentMachine";
import { parentMachine } from "./spawning/parentMachine";
import { stockAcceptanceData, stockCancellationData, stockIssuanceData } from "./transactions";

import { inspect } from "@xstate/inspect";

inspect({
  iframe: false, // recommended setting for local development
});

// Call this before any machines are interpreted
const App = () => {
  const [state, send] = useMachine(parentMachine, {
    devTools: true,
  });

  const [quantity, setQuantity] = useState(100);
  const [security_id, setSecurityId] = useState("sec-id-1");
  const [stakeholder_id, setStakeholderId] = useState("adam-id-1");
  const [stock_class_id, setStockClassId] = useState("common-id-1");

  console.log("state", state);

  const handleAcceptance = (securityId, eventData) => {
    const securityActor = state.context.securities[securityId];
    if (securityActor) {
      securityActor.send({
        type: "TX_STOCK_ACCEPTANCE",
        ...eventData,
      });
    }
  };

  return (
    <div>
      <div>Context:</div>
      <div>
        <pre>{JSON.stringify(state.context, null, 4)}</pre>
      </div>

      <div>State of Parent: {state.value}</div>
      {Object.keys(state.context.securities).map((security) => (
        <div key={security}>
          State of Child <b>{security}</b> : {state.children[security]?._state.value}
        </div>
      ))}

      <div>
        <input value={quantity} placeholder="quantity" onChange={(e) => setQuantity(+e.target.value)}></input>
        <input value={security_id} placeholder="security_id" onChange={(e) => setSecurityId(e.target.value)}></input>
        <input value={stakeholder_id} placeholder="stakeholder_id" onChange={(e) => setStakeholderId(e.target.value)}></input>
        <input value={stock_class_id} placeholder="stock_class_id" onChange={(e) => setStockClassId(e.target.value)}></input>
        <button
          onClick={() =>
            send({
              type: "TX_STOCK_ISSUANCE",
              id: security_id,
              value: {
                activePositions: {},
                activeSecurityIdsByStockClass: {},
                value: {
                  ...stockIssuanceData,
                  security_id,
                  stakeholder_id,
                  quantity,
                  stock_class_id,
                },
              },
            })
          }
        >
          Issue
        </button>
        <button
          onClick={() =>
            handleAcceptance(security_id, {
              security_id,
              stakeholder_id,
              ...stockAcceptanceData,
              stock_class_id,
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

export default App;
