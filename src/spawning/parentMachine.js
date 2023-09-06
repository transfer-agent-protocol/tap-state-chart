import { mergeNestedObjects } from "../helpers";
import { v4 as uuid } from "uuid";
import { actions, createMachine, spawn, stop } from "xstate";
import { stockMachine } from "./stockMachine";
const { assign, raise } = actions;

const handleTransaction = (context, event, transactionType) => {
  const { security_id, stock_class_id, quantity } = event;
  const stakeholder_id =
    transactionType == "transfer"
      ? event.transferor_id
      : context.stakeholder_id || event.stakeholder_id;

  console.log({ stakeholder_id, event });
  const activePosition = context.activePositions[stakeholder_id][security_id];

  if (quantity > activePosition.quantity) {
    throw new Error(
      `cannot ${transactionType} more than quantity of the active position`
    );
  }

  if (quantity === activePosition.quantity) {
    console.log(`complete ${transactionType}`);
    context.isRespawning = false;
    context.balance_security_id = "";
  } else if (quantity < activePosition.quantity) {
    console.log(`partial ${transactionType}`);

    const remainingQuantity = activePosition.quantity - quantity;
    console.log("remainingQuantity", remainingQuantity);

    const spawningSecurityId = uuid().toString().slice(0, 4);
    const spawningActivePosition = {
      ...activePosition,
      quantity: remainingQuantity,
      security_id: spawningSecurityId,
      stakeholder_id,
      stock_class_id,
    };

    context.isRespawning = true;
    context.respawningActivePosition = spawningActivePosition;
    context.respawningSecurityId = spawningSecurityId;
    context.balance_security_id = spawningSecurityId;

    if (transactionType === "transfer") {
      const transfereeSecurityId = uuid().toString().slice(0, 4);
      const transfereeActivePosition = {
        ...activePosition,
        quantity,
        security_id: transfereeSecurityId,
      };

      context.transfereeSecurityId = transfereeSecurityId;
      context.transfereeActivePosition = transfereeActivePosition;
    }
  }
};

const createChildTransaction = (context, event, transactionType) => {
  const { security_id } = event;
  const securityActor = context.securities[security_id];
  const payload = {
    type: transactionType,
    security_id,
    stakeholder_id: event.stakeholder_id || event.transferor_id,
    stock_class_id: event.stock_class_id,
    balance_security_id: context.balance_security_id,
  };

  delete context.balance_security_id;
  if (transactionType === "TX_STOCK_TRANSFER") {
    payload.resulting_security_ids = context.resulting_security_ids;
    delete context.resulting_security_ids;
  }

  securityActor.send(payload);
};

export const parentMachine = createMachine(
  {
    id: "Parent",
    initial: "ready",
    context: {
      securities: {}, // This will store references to spawned child machines
      activePositions: {},
      activeSecurityIdsByStockClass: {},
      transactions: [],
    },
    predictableActionArguments: true,
    preserveActionOrder: true,
    states: {
      ready: {
        on: {
          WAITING: {},
          PRE_STOCK_ISSUANCE: {
            actions: ["spawnSecurity"],
          },
          UPDATE_CONTEXT: {
            actions: ["updateParentContext"],
          },
          STOP_CHILD: {
            actions: ["stopChild"],
          },
          // Only supporting one transfer, not the 1100 problem. This will be a separate helper function because we need multiple issuances and we will aggregate them
          PRE_STOCK_TRANSFER: {
            actions: [
              "preTransfer",
              "createTransferee",
              "respawnSecurityIfNecessary",
              "createChildTransfer",
            ],
          },
          PRE_STOCK_CANCELLATION: {
            actions: [
              "preCancel",
              "respawnSecurityIfNecessary",
              "createChildCancellation",
            ],
          },
          PRE_STOCK_REPURCHASE: {
            actions: [
              "preRepurchase",
              "respawnSecurityIfNecessary",
              "createChildRepurchase",
            ],
          },
        },
      },
    },
  },
  {
    actions: {
      createChildRepurchase: (context, event) => {
        createChildTransaction(context, event, "TX_STOCK_REPURCHASE");
      },
      createChildTransfer: (context, event) => {
        createChildTransaction(context, event, "TX_STOCK_TRANSFER");
      },
      createChildCancellation: (context, event) => {
        createChildTransaction(context, event, "TX_STOCK_CANCELLATION");
      },
      preCancel: assign((context, event) => {
        handleTransaction(context, event, "cancel");
      }),
      preTransfer: assign((context, event) => {
        handleTransaction(context, event, "transfer");
      }),
      preRepurchase: assign((context, event) => {
        handleTransaction(context, event, "repurchase");
      }),
      spawnSecurity: assign((context, event) => {
        const securityId = event.id;
        const newSecurity = spawn(
          stockMachine.withContext(event.value),
          securityId
        );
        return {
          securities: {
            ...context.securities,
            [securityId]: newSecurity,
          },
        };
      }),
      updateParentContext: assign({
        activePositions: (context, event) => {
          return mergeNestedObjects(
            { ...context.activePositions },
            event.value.activePositions
          );
        },
        activeSecurityIdsByStockClass: (context, event) => {
          return mergeNestedObjects(
            { ...context.activeSecurityIdsByStockClass },
            event.value.activeSecurityIdsByStockClass
          );
        },
      }),
      // BUG: in the events tap of the inspector, { TX_STOCK_ISSUANCE } isn't appearing, though new child is created as expected.
      // I think it's because of how "raise" handles event
      // potentially refactor into "pre create" and "TX_STOCK_ISSUANCE" in child machine similar to transfer
      createTransferee: raise((context, event) => {
        const { transfereeSecurityId, transfereeActivePosition } = context;
        const { quantity, transferee_id } = event;
        console.log(" create  transferee with context  ", context);

        console.log("transferee_id", transferee_id);

        const activePosition = transfereeActivePosition;
        const securityId = transfereeSecurityId;

        console.log("active position inside of transferee ", activePosition);

        delete context.transfereeSecurityId;
        delete context.transfereeActivePosition;

        context.resulting_security_ids = [securityId];

        return {
          type: "PRE_STOCK_ISSUANCE",
          id: securityId,
          value: {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: {
              ...activePosition,
              security_id: securityId,
              stakeholder_id: transferee_id,
              quantity,
            },
          },
        };
      }),
      // BUG: in the events tap of the inspector, { TX_STOCK_ISSUANCE } isn't appearing, though logic is working as expected.
      respawnSecurityIfNecessary: raise((context, event) => {
        if (!context.isRespawning) {
          delete context.isRespawning;
          console.log("no respawning necessary");
          return { type: "WAITING" };
        }
        const { respawningActivePosition, respawningSecurityId } = context;

        delete context.respawningActivePosition;
        delete context.respawningSecurityId;
        delete context.isRespawning;

        return {
          type: "PRE_STOCK_ISSUANCE",
          id: respawningSecurityId,
          value: {
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            value: respawningActivePosition,
          },
        };
      }),
      stopChild: assign((context, event) => {
        console.log("inside stop child");
        console.log({ context, event });
        const { security_id, stakeholder_id, stock_class_id } = event.value;

        delete context.securities[security_id];
        delete context.activePositions[stakeholder_id][security_id];
        context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id] =
          context.activeSecurityIdsByStockClass[stakeholder_id][
            stock_class_id
          ].filter((el) => el !== security_id);

        delete context.activeSecurityIdsByStockClass[stakeholder_id][
          stock_class_id
        ];

        stop(security_id);
        return { ...context };
      }),
    },
  }
);
