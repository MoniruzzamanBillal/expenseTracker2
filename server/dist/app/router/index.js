"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainRouter = void 0;
const express_1 = require("express");
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
];
routeArray.forEach((item) => {
    router.use(item.path, item.route);
});
exports.MainRouter = router;
