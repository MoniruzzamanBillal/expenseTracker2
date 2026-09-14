"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainRouter = void 0;
const express_1 = require("express");
const budget_route_1 = require("../modules/budget/budget.route");
const category_route_1 = require("../modules/category/category.route");
const transaction_route_1 = require("../modules/transaction/transaction.route");
const transactionRequest_route_1 = require("../modules/transactionRequest/transactionRequest.route");
const user_route_1 = require("../modules/user/user.route");
const router = (0, express_1.Router)();
const routeArray = [
    {
        path: "/transactions",
        route: transaction_route_1.transactionRouter,
    },
    {
        path: "/transaction-requests",
        route: transactionRequest_route_1.transactionRequestRouter,
    },
    {
        path: "/auth",
        route: user_route_1.userRouter,
    },
    {
        path: "/categories",
        route: category_route_1.categoryRouter,
    },
    {
        path: "/budgets",
        route: budget_route_1.budgetRouter,
    },
];
routeArray.forEach((item) => {
    router.use(item.path, item.route);
});
exports.MainRouter = router;
