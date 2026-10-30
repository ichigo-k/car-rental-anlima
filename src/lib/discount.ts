export function discountFor(rentalAmount: number, type: string, value: number) {
  if (
    !Number.isSafeInteger(rentalAmount) ||
    rentalAmount < 100 ||
    !Number.isSafeInteger(value) ||
    value <= 0
  )
    return 0;
  const amount =
    type === "PERCENT" && value <= 90
      ? Math.floor((rentalAmount * value) / 100)
      : type === "FIXED"
        ? value
        : 0;
  return Math.max(0, Math.min(amount, rentalAmount - 100));
}
