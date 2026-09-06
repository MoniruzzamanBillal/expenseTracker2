"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userServices = void 0;
const argon2_1 = __importDefault(require("argon2"));
const http_status_1 = __importDefault(require("http-status"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AppError_1 = __importDefault(require("../../Error/AppError"));
const config_1 = __importDefault(require("../../config"));
const prisma_1 = require("../../lib/prisma");
const generateObjectId_1 = require("../../util/generateObjectId");
// ! for creating a user
const createUser = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const hashedPassword = yield argon2_1.default.hash(payload.password);
    const result = yield prisma_1.prisma.user.create({
        data: {
            id: (0, generateObjectId_1.generateObjectId)(),
            name: payload.name,
            email: payload.email,
            password: hashedPassword,
            profilePicture: payload.profilePicture,
        },
    });
    return Object.assign(Object.assign({}, result), { _id: result.id });
});
const loginFromDb = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield prisma_1.prisma.user.findUnique({
        where: { email: payload.email },
    });
    if (!userData) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, "User dont exist with this email !!!");
    }
    const isPasswordMatch = yield argon2_1.default.verify(userData.password, payload.password);
    if (!isPasswordMatch) {
        throw new AppError_1.default(http_status_1.default.FORBIDDEN, "Password don't match !!");
    }
    const jwtPayload = {
        userId: userData.id,
        userEmail: userData.email,
    };
    const token = jsonwebtoken_1.default.sign(jwtPayload, config_1.default.jwt_secret, {
        expiresIn: "15d",
    });
    return {
        userData: Object.assign(Object.assign({}, userData), { _id: userData.id }),
        token,
    };
});
exports.userServices = { createUser, loginFromDb };
