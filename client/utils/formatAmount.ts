const group = (n: number, digits: number) =>
  Math.abs(Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/**
 * An amount the user typed, shown back the way they entered it: a whole number
 * stays whole (85 → "85"), a fractional one gets both places (85.5 → "85.50").
 * Entry is capped at two decimals by Keypad's /^\d+(\.\d{0,2})?$/, so nothing
 * is rounded away.
 *
 * Not for the amount being typed — Add/Quick Add format that string as-is so
 * digits don't jump around mid-entry.
 */
export const formatAmount = (n: number): string => {
  const value = Math.abs(Number(n) || 0);
  return group(value, Number.isInteger(value) ? 0 : 2);
};

/**
 * A computed figure — a net, a sum, an average, an amount left or over. Always
 * two decimals, because the arithmetic behind it can land on a fraction the
 * user never typed and a bare "85" next to "85.4" reads as a different kind of
 * number.
 */
export const formatTotal = (n: number): string => group(n, 2);

