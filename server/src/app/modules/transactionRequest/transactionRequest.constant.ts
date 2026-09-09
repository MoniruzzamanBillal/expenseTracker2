export const transactionRequestStatusConstants = {
  pending: "pending",
  accepted: "accepted",
  rejected: "rejected",
} as const;

export const transactionRequestSourceTypeConstants = {
  fuel: "fuel",
  maintenance: "maintenance",
  accessory: "accessory",
} as const;
