import httpStatus from "http-status";
import catchAsync from "../../util/catchAsync";
import sendResponse from "../../util/sendResponse";
import { categoryServices } from "./category.service";

// ! for creating a category
const createCategory = catchAsync(async (req, res) => {
  const result = await categoryServices.createCategory(
    req.body,
    req?.user?.userId,
  );

  sendResponse(res, {
    status: httpStatus.CREATED,
    success: true,
    message: "Category created successfully!!!",
    data: result,
  });
});

// ! for getting the logged-in user's own categories
const getCategories = catchAsync(async (req, res) => {
  const result = await categoryServices.getCategories(req?.user?.userId);

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Categories retrieved successfully!!!",
    data: result,
  });
});

// ! for updating a category
const updateCategory = catchAsync(async (req, res) => {
  const result = await categoryServices.updateCategory(
    req.params?.id,
    req?.user?.userId,
    req?.body,
  );

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

// ! for soft-deleting a category
const deleteCategory = catchAsync(async (req, res) => {
  const result = await categoryServices.deleteCategory(
    req.params?.id,
    req?.user?.userId,
  );

  sendResponse(res, {
    status: httpStatus.OK,
    success: true,
    message: "Category deleted successfully",
    data: result,
  });
});

//
export const categoryController = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
