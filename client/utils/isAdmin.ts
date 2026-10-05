import { IUser } from "@/types/global.types";

/**
 * Mirrors server `middleware/adminCheck.ts`, which is a pure JWT-claim check.
 *
 * `userRole` on the stored user and `userRole` in the JWT both come from the same login
 * response, so this is true exactly when the token carries `userRole: "admin"` — there is
 * never a state where the UI offers an admin action that the API then 403s.
 *
 * Consequence, by design: an existing session (including a user just promoted by a direct DB
 * write) is not an admin here until they log out and log back in, which is the same re-login
 * the server already requires.
 */
export const isAdmin = (user?: IUser | null) => user?.userRole === "admin";
