export type IUser = {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
};

export type TUserToken = {
  userId: string;
  userEmail: string;
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
