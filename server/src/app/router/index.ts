import { Router } from "express";
import { budgetRouter } from "../modules/budget/budget.route";
import { categoryRouter } from "../modules/category/category.route";
import {
  errorLogCronRouter,
  errorLogRouter,
} from "../modules/errorLog/errorLog.route";
import { transactionRouter } from "../modules/transaction/transaction.route";
import { transactionRequestRouter } from "../modules/transactionRequest/transactionRequest.route";
import { userRouter } from "../modules/user/user.route";

const router = Router();

const routeArray = [
  {
    path: "/transactions",
    route: transactionRouter,
  },
  {
    path: "/transaction-requests",
    route: transactionRequestRouter,
  },
  {
    path: "/auth",
    route: userRouter,
  },
  {
    path: "/categories",
    route: categoryRouter,
  },
  {
    path: "/budgets",
    route: budgetRouter,
  },
  {
    path: "/admin/error-logs",
    route: errorLogRouter,
  },
  // ! no authCheck on this one — guarded by the x-cron-secret header in the controller
  {
    path: "/cron",
    route: errorLogCronRouter,
  },
];

routeArray.forEach((item) => {
  router.use(item.path, item.route);
});

export const MainRouter = router;
