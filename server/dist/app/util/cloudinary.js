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
exports.uploadDocumentBuffer = exports.deleteCloudinaryImage = void 0;
const cloudinary_1 = require("cloudinary");
const config_1 = __importDefault(require("../config"));
cloudinary_1.v2.config({
    cloud_name: config_1.default.cloudinary_cloud_name,
    api_key: config_1.default.cloudinary_api_key,
    api_secret: config_1.default.cloudinary_api_secret,
});
// ! best-effort cleanup — never throws, so a failed delete never blocks the caller's actual action
const deleteCloudinaryImage = (publicId_1, ...args_1) => __awaiter(void 0, [publicId_1, ...args_1], void 0, function* (publicId, resourceType = "image") {
    try {
        yield cloudinary_1.v2.uploader.destroy(publicId, { resource_type: resourceType });
    }
    catch (error) {
        console.log("Cloudinary delete failed", error);
    }
});
exports.deleteCloudinaryImage = deleteCloudinaryImage;
// ! resource_type is picked per-file from its mimetype, not hardcoded — an "image" upload
// ! of a PDF buffer would otherwise get destroyed incorrectly later (silent Cloudinary no-op)
const uploadDocumentBuffer = (buffer, mimetype) => {
    const resourceType = mimetype.startsWith("image/")
        ? "image"
        : "raw";
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({ resource_type: resourceType }, (error, result) => {
            if (error || !result) {
                return reject(error);
            }
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
                resourceType,
            });
        });
        uploadStream.end(buffer);
    });
};
exports.uploadDocumentBuffer = uploadDocumentBuffer;
