import { v4 as uuid } from "uuid";

const testSecurityId = "7c542651-7b06-4133-9f93-7e6236fa42f1";
export const stockIssuanceData = {
  security_id: testSecurityId,
  stakeholder_id: "7c542651-7b06-4133-9f93-7e6236fa42f1",
  stock_class_id: "aa225a44-a481-4b43-8ac7-f3ae9b41e140",
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
  security_id: testSecurityId,
  comments: [],
};
