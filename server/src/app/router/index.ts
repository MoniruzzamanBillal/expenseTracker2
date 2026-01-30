import { Router } from "express";
import { transactionRouter } from "../modules/transaction/transaction.route";
import { userRouter } from "../modules/user/user.route";

const router = Router();

const routeArray = [
  {
    path: "/transactions",
    route: transactionRouter,
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
