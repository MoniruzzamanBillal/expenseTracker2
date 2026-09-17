import { z } from "zod";

// Validation schema for creating a new user
const createUserSchema = z.object({
  body: z.object({
    name: z.string({ required_error: "User name is required" }),
    email: z
      .string({ required_error: "User email is required" })
      .email({ message: "Invalid email address" }),
    password: z
      .string({ required_error: "User password is required" })
      .min(6, { message: "Password must be at least 6 characters long" }),
  }),
});

// Validation schema for login
const loginValidationSchema = z.object({
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(1, { message: "Password cannot be empty" }),
  }),
});

// Validation schema for updating the logged-in user's profile
const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
  }),
});

//
export const userValidations = {
  createUserSchema,
  loginValidationSchema,
  updateProfileSchema,
};
