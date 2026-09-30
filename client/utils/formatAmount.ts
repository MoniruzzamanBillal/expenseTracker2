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

/**
 * A figure that has to fit a chart axis tick or another few-character slot,
 * where `formatTotal`'s grouped two decimals ("1,23,456.00") would need a row
 * of its own. Steps at thousand and lakh because the rest of the app groups
 * en-IN, and uses U+2212 for negatives like every other negative figure in the
 * UI. Lossy by design — never use it where the exact amount matters.
 */
export const formatCompact = (n: number): string => {
  const value = Number(n) || 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  // One decimal below 10 of a unit ("1.2k"), none above ("12k"), so a tick is
  // at most four characters wide.
  const trim = (v: number) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  if (abs >= 1e5) return `${sign}${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)}k`;
  return `${sign}${Math.round(abs)}`;
};

