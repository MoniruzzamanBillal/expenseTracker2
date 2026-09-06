export type IUser = {
  _id: string;
  name: string;
  email: string;
  profilePicture?: string | null;
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
