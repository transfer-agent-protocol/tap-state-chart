export const stockIssuanceData = {
  share_price: {
    currency: "USD",
    amount: "1.20",
  },
  // "stock_plan_id": "00000000-0000-0000-0000-000000000000",
  // "share_numbers_issued": [0,0],
  // "vesting_terms_id": "00000000-0000-0000-0000-000000000000",
  //   cost_basis: {
  //     currency: "USD",
  //     amount: "1.20",
  //   },
  stock_legend_ids: ["8906b5ae-0b30-44d0-bdf0-57548b4bb6d3"],
  // "issuance_type": "",
  comments: [],
  // "custom_id": "",
  // "board_approval_date": "", // omit if null
  // "stockholder_approval_date": "", // same as above
  // "consideration_text": "",
  // "security_law_exemptions": []
};

export const stockAcceptanceData = {
  comments: [],
};

// quantity id added in App
export const stockCancellationData = {
  comments: [],
  balance_security_id: "", // this will be determined in the machine based on the quantity
  reason_text: "because he died, Rebecca.",
};
