import { v2 as cloudinary } from "cloudinary";
import config from "../config";

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
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.log("Cloudinary delete failed", error);
  }
};

// ! resource_type is picked per-file from its mimetype, not hardcoded — an "image" upload
// ! of a PDF buffer would otherwise get destroyed incorrectly later (silent Cloudinary no-op)
const uploadDocumentBuffer = (
  buffer: Buffer,
  mimetype: string,
): Promise<{ url: string; publicId: string; resourceType: "image" | "raw" }> => {
  const resourceType: "image" | "raw" = mimetype.startsWith("image/")
    ? "image"
    : "raw";

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType },
      (error, result) => {
        if (error || !result) {
          return reject(error);
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType,
        });
      },
    );

    uploadStream.end(buffer);
  });
};

export { deleteCloudinaryImage, uploadDocumentBuffer };
