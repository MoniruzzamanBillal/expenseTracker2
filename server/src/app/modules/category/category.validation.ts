import { z } from "zod";

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    icon: z.string().min(1).optional(),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    icon: z.string().min(1).optional(),
  }),
});

//
export const categoryValidations = {
  createCategorySchema,
  updateCategorySchema,
};
