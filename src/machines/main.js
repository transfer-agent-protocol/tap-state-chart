import { v4 as uuid } from "uuid";
import {
  mergeNestedObjects,
  handleTransaction,
  createChildTransaction,
} from "../helpers";
import { actions, createMachine, spawn, stop } from "xstate";
import stockMachine from "./stock";
import stockClassMachine from "./stockClass";
import { uniqueId } from "xstate/lib/utils";

const { assign, raise } = actions;

const mainMachine = createMachine(
  {
    id: "Main",
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
            actions: ["spawnSecurities"],
          },
          UPDATE_CONTEXT: {
            actions: ["updateParentContext"],
          },
          SPAWN_SECURITIES: {
            actions: ["spawnSecurities"],
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
          PRE_STOCK_REISSUE: {
            actions: ["spawnStockClass", "createChildReissue"],
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
      createChildReissue: (context, event) => {
        createChildTransaction(context, event.value, "TX_STOCK_REISSUE");
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
      _preReissue: assign(
        (
          context,
          { quantity, id, security_id, stakeholder_id, splitRatio }
        ) => ({
          ...context,
          stockClass: id,
          security_id,
          quantity,
          splitRatio,
          stakeholder_id,
        })
      ),
      spawnStockClass: assign((context, event) => {
        const stockClass = spawn(
          stockClassMachine.withContext(event.value),
          event.id
        );
        return {
          stockClasses: {
            ...context.stockClasses,
            [event.id]: stockClass,
          },
        };
      }),
      spawnSecurities: assign((context, event) => {
        console.log("inside spawnSecurities (parent)");
        console.log({ context, event });

        const numberOfNewSecurities =
          event.value.value?.initialSharesAuthorized || 1;
        const newSecurities = {};
        const isSplitted = Boolean(numberOfNewSecurities !== 1);
        for (let i = 0; i < numberOfNewSecurities; i++) {
          const sId = isSplitted
            ? `splitted-sec-id-${uniqueId()}`
            : `sec-id-${uniqueId()}`;
          event.value.value.security_id = sId;
          newSecurities[sId] = spawn(
            stockMachine.withContext(event.value),
            sId
          );
        }
        return {
          securities: {
            ...context.securities,
            ...newSecurities,
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
export default mainMachine;
