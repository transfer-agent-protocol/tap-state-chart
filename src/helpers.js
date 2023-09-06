import { v4 as uuid } from "uuid";

export const mergeNestedObjects = (target, source) => {
  for (const key in source) {
    if (typeof target[key] === 'object' && typeof source[key] === 'object') {
      mergeNestedObjects(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
};

export const handleTransaction = (context, event, transactionType) => {
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

export const createChildTransaction = (context, event, transactionType) => {
   console.log({context, event})
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



export const updateContext = (context, _) => {
  console.log("context  ", context);
  console.log("context inside of updateContext ", context);
  const { stakeholder_id, stock_class_id, security_id, quantity, share_price } = context.value;

  //Update Active Positions
  // if active position is empty for this stakeholder, create it
  if (!context.activePositions[stakeholder_id]) {
    context.activePositions[stakeholder_id] = {};
  }
  context.activePositions[stakeholder_id][security_id] = {
    stock_class_id,
    quantity,
    share_price,
    timestamp: new Date().toISOString(),
    accepted: false,
  };

  // Update Security ID indexer
  if (!context.activeSecurityIdsByStockClass[stakeholder_id]) {
    context.activeSecurityIdsByStockClass[stakeholder_id] = {};
  }

  if (!context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id]) {
    context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id] = [];
  }

  context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id].push(security_id);
};
