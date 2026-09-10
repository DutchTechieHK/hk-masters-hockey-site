export function sanitizePlayerPayload(data: Record<string, any>): Record<string, any> {
  const {
    paymentAmountPaid,
    paymentDate,
    feePaid,
    ...sanitized
  } = data;
  return sanitized;
}
