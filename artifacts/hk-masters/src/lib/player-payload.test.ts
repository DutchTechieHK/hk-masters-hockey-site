import { sanitizePlayerPayload } from "./player-payload";

export function runPlayerPayloadTests() {
  const payload = {
    name: "John",
    feePaid: true,
    paymentAmountPaid: 500,
    paymentDate: "2024-01-01",
    teamId: 1
  };
  
  const result = sanitizePlayerPayload(payload);
  
  if (result.feePaid !== undefined) throw new Error("feePaid should be omitted");
  if (result.paymentAmountPaid !== undefined) throw new Error("paymentAmountPaid should be omitted");
  if (result.paymentDate !== undefined) throw new Error("paymentDate should be omitted");
  if (result.name !== "John" || result.teamId !== 1) throw new Error("Other fields should be preserved");
  
  console.log("Player payload sanitization tests passed.");
}
