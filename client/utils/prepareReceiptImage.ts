import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type TReceiptFile = {
  uri: string;
  name: string;
  type: string;
};

// Long edge cap. A modern phone camera shoots ~4000px wide; at `quality: 0.7` with no resize
// that is routinely several MB, which is above Vercel's ~4.5MB serverless request-body cap and
// above the server's own 4MB multer limit (server spec 15). 1600px keeps a receipt's text
// comfortably legible while landing well under both.
const MAX_EDGE = 1600;

// 0.6 rather than the picker's 0.7 — the resize already removed most of the bytes, so this is
// the cheap second pass, not the main lever.
const COMPRESS = 0.6;

/**
 * Downscales and re-compresses a picked image before upload, returning the same
 * `{ uri, name, type }` shape the FormData append expects.
 *
 * Only images go through here. PDFs are passed through untouched by callers — they have no
 * pixel dimensions to resize, and re-encoding one as JPEG would corrupt it.
 *
 * Best-effort: if manipulation fails for any reason, the original file is returned rather than
 * blocking the upload. A too-large upload now fails with a clean 400 from the server (spec 15),
 * which is a better outcome than refusing to try.
 */
export const prepareReceiptImage = async (
  file: TReceiptFile,
  sourceWidth?: number,
  sourceHeight?: number,
): Promise<TReceiptFile> => {
  try {
    const context = ImageManipulator.manipulate(file.uri);

    // Resize only when it would actually shrink the image — upscaling a small receipt photo
    // would add bytes for no gain. Dimensions are unknown when the picker didn't report them,
    // in which case cap the width and let the height follow the aspect ratio.
    const longEdge = Math.max(sourceWidth ?? 0, sourceHeight ?? 0);

    if (longEdge > MAX_EDGE) {
      const isLandscape = (sourceWidth ?? 0) >= (sourceHeight ?? 0);
      context.resize(isLandscape ? { width: MAX_EDGE } : { height: MAX_EDGE });
    } else if (!longEdge) {
      context.resize({ width: MAX_EDGE });
    }

    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: COMPRESS,
    });

    // The output is always JPEG, so the name/type must follow or the server's mimetype-driven
    // Cloudinary `resource_type` pick and its own fileFilter would disagree with the bytes.
    return {
      uri: result.uri,
      name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      type: "image/jpeg",
    };
  } catch (error) {
    console.log("receipt downscale failed, uploading original = ", error);
    return file;
  }
};
