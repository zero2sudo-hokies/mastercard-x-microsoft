import type { TopicId } from "./types";

export const TOPICS: TopicId[] = ["fees", "fraud_scams", "transfers", "account_closed", "customer_service", "distrust"];

export const TOPIC_LABEL: Record<TopicId, string> = {
  fees: "Fees",
  fraud_scams: "Fraud and scams",
  transfers: "Transfers",
  account_closed: "Account closures",
  customer_service: "Customer service",
  distrust: "Distrust",
};

// 24x24 stroke paths, drawn by components/ui/TopicIcon.tsx
export const TOPIC_ICON: Record<TopicId, string> = {
  fees: "M12 3v18M16 7h-6a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H8",
  fraud_scams: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z",
  transfers: "M4 8h15l-3-3M20 16H5l3 3",
  account_closed: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z",
  customer_service: "M4 5h16v11H9l-5 4V5z",
  distrust: "M9 9a3 3 0 1 1 6 0c0 2-3 2-3 4M12 17v.5",
};

export const BENEFIT_TITLE: Record<string, string> = {
  no_fee_account: "No-fee account (no overdraft, no minimum balance)",
  fraud_protection: "Fraud protection (alerts, scam warnings, fast reimbursement)",
  low_cost_transfers: "Low-cost card-funded transfers",
  second_chance_account: "Second-chance account",
  partner_support_line: "Human support line run with the local partner",
  trusted_partner_onboarding: "Onboarding through a trusted local partner",
};
