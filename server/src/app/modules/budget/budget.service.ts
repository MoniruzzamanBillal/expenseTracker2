import { Prisma } from "@prisma/client";
import httpStatus from "http-status";
import AppError from "../../Error/AppError";
import { prisma } from "../../lib/prisma";
import { generateObjectId } from "../../util/generateObjectId";
import { TBudget } from "./budget.interface";

// ! ownership check for a user-supplied categoryId
const assertCategoryOwnership = async (categoryId: string, userId: string) => {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId, isDeleted: false },
  });

  if (!category) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid category id !!!");
  }
};

// ! for creating a budget
const createBudget = async (payload: TBudget, userId: string) => {
  await assertCategoryOwnership(payload.categoryId, userId);

  try {
    const result = await prisma.budget.create({
      data: {
        id: generateObjectId(),
        userId,
        categoryId: payload.categoryId,
        monthlyLimit: payload.monthlyLimit,
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
        "A budget already exists for this category — update it instead",
      );
    }

    throw error;
  }
};

// ! for listing the user's budgets, enriched with this month's actual spend
const getBudgets = async (userId: string) => {
  const budgetsRaw = await prisma.budget.findMany({
    where: { userId },
    include: { category: true },
  });

  const budgets = budgetsRaw.filter((budget) => !budget.category.isDeleted);

  const budgetCategoryIds = budgets.map((budget) => budget.categoryId);

  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const spendByCategory = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      categoryId: { in: budgetCategoryIds },
      type: "expense",
      isDeleted: false,
      createdAt: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });

  return budgets.map((budget) => {
    const spentEntry = spendByCategory.find(
      (entry) => entry.categoryId === budget.categoryId,
    );
    const spent = Number(spentEntry?._sum.amount ?? 0);
    const monthlyLimit = Number(budget.monthlyLimit);
    const percentage = (spent / monthlyLimit) * 100;

    return {
      _id: budget.id,
      categoryId: budget.categoryId,
      category: { name: budget.category.name, icon: budget.category.icon },
      monthlyLimit,
      spent,
      percentage,
      isOverLimit: spent > monthlyLimit,
    };
  });
};

// ! for updating a budget's limit
const updateBudget = async (id: string, userId: string, monthlyLimit: number) => {
  const budgetData = await prisma.budget.findFirst({
    where: { id, userId },
  });

  if (!budgetData) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid budget id !!!");
  }

  const result = await prisma.budget.update({
    where: { id },
    data: { monthlyLimit },
  });

  return { ...result, _id: result.id };
};

// ! for deleting a budget (real hard delete — see spec 12's Design note)
const deleteBudget = async (id: string, userId: string) => {
  const budgetData = await prisma.budget.findFirst({
    where: { id, userId },
  });

  if (!budgetData) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid budget id !!!");
  }

  const result = await prisma.budget.delete({
    where: { id },
  });

  return { ...result, _id: result.id };
};

//
export const budgetServices = {
  createBudget,
  getBudgets,
  updateBudget,
  deleteBudget,
};
