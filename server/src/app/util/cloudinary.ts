import { v2 as cloudinary } from "cloudinary";
import httpStatus from "http-status";
import config from "../config";
import AppError from "../Error/AppError";

cloudinary.config({
  cloud_name: config.cloudinary_cloud_name,
  api_key: config.cloudinary_api_key,
  api_secret: config.cloudinary_api_secret,
});

// ! best-effort cleanup — never throws, so a failed delete never blocks the caller's actual action
const deleteCloudinaryImage = async (
  publicId: string,
  resourceType: "image" | "raw" = "image",
): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    console.log("Cloudinary delete failed", error);
  }
};

// ! resource_type is picked per-file from its mimetype, not hardcoded — an "image" upload
// ! of a PDF buffer would otherwise get destroyed incorrectly later (silent Cloudinary no-op)
const uploadDocumentBuffer = (
  buffer: Buffer,
  mimetype: string,
): Promise<{
  url: string;
  publicId: string;
  resourceType: "image" | "raw";
}> => {
  const resourceType: "image" | "raw" = mimetype.startsWith("image/")
    ? "image"
    : "raw";

  return new Promise((resolve, reject) => {
    // ! upload_stream validates credentials EAGERLY and SYNCHRONOUSLY (utils.api_url ->
    // ! ensureOption) and throws a bare STRING — "Must supply cloud_name"/"api_key"/
    // ! "api_secret" — with no .message/.status/.stack, so the callback below never runs.
    // ! globalErrorHandler then produced `500 "Something went wrong!!"` from its own
    // ! fallbacks, which is exactly the opaque error a missing Vercel env var surfaced as.
    // ! See specs/16-fix-cloudinary-sync-throw-root-cause.md.
    let uploadStream: ReturnType<typeof cloudinary.uploader.upload_stream>;

    try {
      uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType },
        (error, result) => {
          // ! Cloudinary's error is a plain object carrying `http_code`, not `status`, so
          // ! globalErrorHandler's `error.status || 500` turned every failure (including a
          // ! plain bad-credentials one) into a 500 with an internal message + stack (#ERR-1).
          // ! It also used to `reject(error)` on `!result` with a falsy error, i.e.
          // ! reject(undefined) -> catchAsync's next(undefined), which Express reads as "no
          // ! error" and falls through to the 404 handler ("API NOT FOUND!") for a failed
          // ! upload. An AppError fixes both: one shaped 502, real cause logged server-side.
          if (error || !result) {
            console.error("Cloudinary upload failed", error);
            return reject(
              new AppError(
                httpStatus.BAD_GATEWAY,
                "Receipt upload failed, please try again",
              ),
            );
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType,
          });
        },
      );
    } catch (configError) {
      // ! logged, not returned: the real cause belongs in the server log, the caller gets
      // ! one shaped 502 (same best-effort-log convention as deleteCloudinaryImage).
      console.error(
        "Cloudinary upload_stream threw synchronously",
        configError,
      );
      return reject(
        new AppError(
          httpStatus.BAD_GATEWAY,
          "Receipt upload failed, please try again",
        ),
      );
    }

    uploadStream.end(buffer);
  });
};

export { deleteCloudinaryImage, uploadDocumentBuffer };
