import { v4 as uuid } from "uuid";
import { actions, createMachine, spawn, stop } from "xstate";
import { stockMachine } from "./stockMachine";
const { assign, raise } = actions;

// Modularized functions
const updateContext = (context, event, key) => {
  const updatedContext = { ...context[key] };
  for (const stakeholderId in event.value[key]) {
    updatedContext[stakeholderId] = {
      ...updatedContext[stakeholderId],
      ...event.value[key][stakeholderId],
    };
  }
  return updatedContext;
};

const spawnNewSecurity = (context, event) => {
  const securityId = event.id;
  const newSecurity = spawn(stockMachine.withContext(event.value), securityId);
  return {
    ...context.securities,
    [securityId]: newSecurity,
  };
};

const stopAndDeleteChild = (context, event) => {
  const { security_id, stakeholder_id, stock_class_id } = event.value;
  delete context.securities[security_id];
  delete context.activePositions[stakeholder_id][security_id];
  delete context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id];
  stop(security_id);
};

const handleTransfer = (context, event) => {
  const { quantity, transferor_id, security_id } = event;
  const activePosition = context.activePositions[transferor_id][security_id];
  if (quantity > activePosition.quantity) {
    throw new Error("cannot transfer more than quantity of the active position");
  }
  if (quantity === activePosition.quantity) {
    context.isRespawning = false;
    context.balance_security_id = "";
  } else if (quantity < activePosition.quantity) {
    const remainingQuantity = activePosition.quantity - quantity;
    const spawningSecurityId = uuid().toString().slice(0, 4);
    const spawningActivePosition = {
      ...activePosition,
      quantity: remainingQuantity,
      security_id: spawningSecurityId,
      stakeholder_id: transferor_id,
    };
    context.isRespawning = true;
    context.respawningActivePosition = spawningActivePosition;
    context.respawningSecurityId = spawningSecurityId;
    context.balance_security_id = spawningSecurityId;
  }
  const transfereeSecurityId = uuid().toString().slice(0, 4);
  const transfereeActivePosition = {
    ...activePosition,
    quantity,
    security_id: transfereeSecurityId,
  };
  context.transfereeSecurityId = transfereeSecurityId;
  context.transfereeActivePosition = transfereeActivePosition;
};

const handleCancellation = (context, event) => {
  const { quantity, stakeholder_id, security_id } = event;
  const activePosition = context.activePositions[stakeholder_id][security_id];
  if (!activePosition) {
    throw new Error("cannot find active position");
  }
  if (quantity === activePosition.quantity) {
    context.isRespawning = false;
    context.balance_security_id = "";
  } else if (quantity < activePosition.quantity) {
    const remainingQuantity = activePosition.quantity - quantity;
    const spawningSecurityId = uuid().toString().slice(0, 4);
    const spawningActivePosition = {
      ...activePosition,
      quantity: remainingQuantity,
      security_id: spawningSecurityId,
      stakeholder_id,
    };
    context.balance_security_id = spawningSecurityId;
    context.isRespawning = true;
    context.respawningActivePosition = spawningActivePosition;
    context.respawningSecurityId = spawningSecurityId;
  } else {
    throw new Error("cannot cancel more than quantity of the active position");
  }
};

// Machine definition
export const parentMachine = createMachine(
  {
    id: "Parent",
    initial: "ready",
    context: {
      securities: {},
      activePositions: {},
      activeSecurityIdsByStockClass: {},
      transactions: [],
    },
    states: {
      ready: {
        on: {
          WAITING: {},
          TX_STOCK_ISSUANCE: { actions: "spawnSecurity" },
          UPDATE_CONTEXT: { actions: "updateParentContext" },
          STOP_CHILD_FOR_CANCELLATION: { actions: ["stopChild", "respawnSecurityIfNecessary"] },
          STOP_CHILD_FOR_TRANSFER: { actions: ["stopChild"] },
          PRE_STOCK_TRANSFER: { actions: ["handleTransfer", "createTransferee", "respawnSecurityIfNecessary", "createChildTransfer"] },
          PRE_STOCK_CANCELLATION: { actions: ["handleCancellation", "respawnSecurityIfNecessary", "createChildCancellation"] },
        },
      },
    },
  },
  {
    actions: {
      createChildTransfer: (context, event) => {
        const { security_id } = event;
        const { balance_security_id, resulting_security_ids } = context;
        const securityActor = context.securities[security_id];
        delete context.balance_security_id;
        delete context.resulting_security_ids;
        securityActor.send({
          type: "TX_STOCK_TRANSFER",
          security_id,
          stakeholder_id: event.transferor_id,
          stock_class_id: event.stock_class_id,
          balance_security_id,
          resulting_security_ids,
        });
      },
      createChildCancellation: (context, event) => {
        const { security_id } = event;
        const { balance_security_id } = context;
        delete context.balance_security_id;
        const securityActor = context.securities[security_id];
        securityActor.send({
          type: "TX_STOCK_CANCELLATION",
          security_id,
          stakeholder_id: event.stakeholder_id,
          stock_class_id: event.stock_class_id,
          balance_security_id,
        });
      },
      handleTransfer: (context, event) => handleTransfer(context, event),
      handleCancellation: (context, event) => handleCancellation(context, event),
      spawnSecurity: assign((context, event) => ({ securities: spawnNewSecurity(context, event) })),
      updateParentContext: assign({
        activePositions: (context, event) => updateContext(context, event, "activePositions"),
        activeSecurityIdsByStockClass: (context, event) => updateContext(context, event, "activeSecurityIdsByStockClass"),
      }),
      createTransferee: raise((context, event) => {
        const { transfereeSecurityId, transfereeActivePosition } = context;
        const { quantity, transferee_id } = event;
        delete context.transfereeSecurityId;
        delete context.transfereeActivePosition;
        context.resulting_security_ids = [transfereeSecurityId];
        return {
          type: "TX_STOCK_ISSUANCE",
          id: transfereeSecurityId,
          value: {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: {
              ...transfereeActivePosition,
              security_id: transfereeSecurityId,
              stakeholder_id: transferee_id,
              quantity,
            },
          },
        };
      }),
      respawnSecurityIfNecessary: raise((context, event) => {
        if (!context.isRespawning) {
          delete context.isRespawning;
          return { type: "WAITING" };
        }
        const { respawningActivePosition, respawningSecurityId } = context;
        delete context.respawningActivePosition;
        delete context.respawningSecurityId;
        delete context.isRespawning;
        return {
          type: "TX_STOCK_ISSUANCE",
          id: respawningSecurityId,
          value: {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: respawningActivePosition,
          },
        };
      }),
      stopChild: assign((context, event) => stopAndDeleteChild(context, event)),
    },
  }
);

