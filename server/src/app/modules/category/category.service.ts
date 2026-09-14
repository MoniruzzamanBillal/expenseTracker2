import { Prisma } from "@prisma/client";
import httpStatus from "http-status";
import AppError from "../../Error/AppError";
import { prisma } from "../../lib/prisma";
import { generateObjectId } from "../../util/generateObjectId";
import { TCategory } from "./category.interface";

// ! for creating a category
const createCategory = async (payload: TCategory, userId: string) => {
  try {
    const result = await prisma.category.create({
      data: {
        id: generateObjectId(),
        userId,
        name: payload.name,
        icon: payload.icon,
      },
    });

    return { ...result, _id: result.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "A category with this name already exists",
      );
    }

    throw error;
  }
};

// ! for getting the logged-in user's own non-deleted categories
const getCategories = async (userId: string) => {
  const result = await prisma.category.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: "asc" },
  });

  return result.map((category) => ({ ...category, _id: category.id }));
};

// ! for updating a category (rename and/or change icon)
const updateCategory = async (
  id: string,
  userId: string,
  payload: Partial<TCategory>,
) => {
  const categoryData = await prisma.category.findFirst({
    where: { id, userId, isDeleted: false },
  });

  if (!categoryData) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid category id !!!");
  }

  try {
    const result = await prisma.category.update({
      where: { id },
      data: payload,
    });

    return { ...result, _id: result.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "A category with this name already exists",
      );
    }

    throw error;
  }
};

// ! for soft-deleting a category
const deleteCategory = async (id: string, userId: string) => {
  const categoryData = await prisma.category.findFirst({
    where: { id, userId, isDeleted: false },
  });

  if (!categoryData) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid category id !!!");
  }

  const result = await prisma.category.update({
    where: { id },
    data: { isDeleted: true },
  });

  return { ...result, _id: result.id };
};

//
export const categoryServices = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
