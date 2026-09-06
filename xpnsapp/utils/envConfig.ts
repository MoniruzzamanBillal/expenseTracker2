// Point this at your ExpenseTracker API before running the app.
export const baseURL = "https://YOUR_API_URL";

export const getBaseUrl = (): string => {
  return `${baseURL}/api`;
};
