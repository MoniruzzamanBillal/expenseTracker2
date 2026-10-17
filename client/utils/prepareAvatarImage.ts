import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { TReceiptFile } from "./prepareReceiptImage";

// Avatars are displayed at <= 88px, so 512 is generous for any density and keeps the upload
// at ~50-150KB, far below the server's 2MB multer cap and Vercel's ~4.5MB body cap
// (server spec 20 D3).
const AVATAR_SIZE = 512;
const COMPRESS = 0.7;

/**
 * Centre-crops a picked image to a square, resizes it to 512x512 and re-encodes as JPEG,
 * returning the `{ uri, name, type }` shape the FormData append expects.
 *
 * The crop matters on web, where `allowsEditing` is ignored; after a native crop it is a
 * harmless no-op.
 *
 * Best-effort, same contract as prepareReceiptImage: if manipulation fails the original file
 * is returned rather than blocking the upload.
 */
export const prepareAvatarImage = async (
  file: TReceiptFile,
  sourceWidth?: number,
  sourceHeight?: number,
): Promise<TReceiptFile> => {
  try {
    const context = ImageManipulator.manipulate(file.uri);

    if (sourceWidth && sourceHeight && sourceWidth !== sourceHeight) {
      const side = Math.min(sourceWidth, sourceHeight);
      context.crop({
        originX: Math.floor((sourceWidth - side) / 2),
        originY: Math.floor((sourceHeight - side) / 2),
        width: side,
        height: side,
      });
    }

    context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });

    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: COMPRESS,
    });

    // Name/type must follow the re-encoded bytes, or the server's image/* filter and the
    // bytes would disagree.
    return {
      uri: result.uri,
      name: "avatar.jpg",
      type: "image/jpeg",
    };
  } catch (error) {
    console.log("avatar prepare failed, uploading original = ", error);
    return file;
  }
};
