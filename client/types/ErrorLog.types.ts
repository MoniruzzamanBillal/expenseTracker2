// Hand-mirrors server/src/app/modules/errorLog/errorLog.interface.ts plus the `_id` that
// errorLog.service.ts's `toApiShape` adds. There is no shared types package — the two sides
// are kept in sync by hand, by convention (known-issues.md#TYPE-2).

/** Matches the server's `TerrorSource` — note `path` can be a number (array-index paths). */
export type TErrorLogSource = {
  path: string | number;
  message: string;
}[];

export type TErrorLog = {
  _id: string;
  id: string;
  status: number;
  message: string;
  errorName?: string | null;
  // A JSON column, so this is what it is *supposed* to hold, not a guarantee — render it
  // behind an Array.isArray check rather than trusting the type.
  errorSources?: TErrorLogSource | null;
  // Absent on 404 rows: that error is synthetic, so the server deliberately stores no stack.
  stack?: string | null;
  method: string;
  path: string;
  userId?: string | null;
  userEmail?: string | null;
  createdAt: string;
};

export type TErrorLogMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/**
 * The `data` of the list response. `meta` is nested *inside* `data` — `sendResponse` emits
 * `{ success, message, data, token }` and the service returns `{ result, meta }` as that
 * `data` — so the read path in a component is `data?.data?.result` / `data?.data?.meta`.
 */
export type TErrorLogListPayload = {
  result: TErrorLog[];
  meta: TErrorLogMeta;
};
