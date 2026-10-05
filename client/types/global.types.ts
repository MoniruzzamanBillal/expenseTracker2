// Mirrors the server's Role enum (prisma/schema.prisma). Optional because a session
// stored before spec 36 shipped has no such field, and because /auth/me's select omits it.
export type TUserRole = "user" | "admin";

export type IUser = {
  _id: string;
  name: string;
  email: string;
  // ! Carried from the login response only (app/auth.tsx) — /auth/me does NOT return it.
  // ! That is deliberate: it makes "the client thinks I'm an admin" true exactly when the
  // ! stored JWT carries the userRole claim the server's adminCheck reads.
  userRole?: TUserRole;
  profilePicture?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
};

export type TUserToken = {
  userId: string;
  userEmail: string;
  // Minted since server spec 17; absent in tokens issued before it.
  userRole?: TUserRole;
  iat?: number;
  exp?: number;
};

export type TLoginPayload = {
  email: string;
  password: string;
};

export type TRegisterPayload = {
  name: string;
  email: string;
  password: string;
};
