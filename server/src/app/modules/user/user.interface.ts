export type TUserRole = "admin" | "user";

export type TUser = {
  name: string;
  email: string;
  password: string;
  profilePicture?: string;
  isDeleted: boolean;
  userRole: TUserRole;
};

export const UserRole = {
  admin: "admin",

  user: "user",
} as const;
