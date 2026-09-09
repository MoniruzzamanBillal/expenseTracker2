import { Router } from "express";
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
];

routeArray.forEach((item) => {
  router.use(item.path, item.route);
});

export const MainRouter = router;
