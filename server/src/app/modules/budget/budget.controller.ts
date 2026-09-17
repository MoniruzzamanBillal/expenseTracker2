import httpStatus from "http-status";
import catchAsync from "../../util/catchAsync";
import sendResponse from "../../util/sendResponse";
import { budgetServices } from "./budget.service";

// ! for creating a budget
const createBudget = catchAsync(async (req, res) => {
  const result = await budgetServices.createBudget(req.body, req?.user?.userId);

  sendResponse(res, {
    status: httpStatus.CREATED,
    success: true,
    message: "Budget created successfully!!!",
    data: result,
  });
});

// ! for listing the user's budgets
const getBudgets = catchAsync(async (req, res) => {
  const result = await budgetServices.getBudgets(req?.user?.userId);

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Budgets retrieved successfully!!!",
    data: result,
  });
});

// ! for updating a budget's limit
const updateBudget = catchAsync(async (req, res) => {
  const result = await budgetServices.updateBudget(
    req.params?.id,
    req?.user?.userId,
    req.body?.monthlyLimit,
  );

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Budget updated successfully",
    data: result,
  });
});

// ! for deleting a budget
const deleteBudget = catchAsync(async (req, res) => {
  const result = await budgetServices.deleteBudget(
    req.params?.id,
    req?.user?.userId,
  );

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Budget deleted successfully",
    data: result,
  });
});

//
export const budgetController = {
  createBudget,
  getBudgets,
  updateBudget,
  deleteBudget,
};
