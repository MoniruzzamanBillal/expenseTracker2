import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,

  // ! two independent secrets, deliberately not one (spec 18 D1). With a single secret a
  // ! 15-day refresh token verifies fine in authCheck and buys a 15-day session, which
  // ! undoes the whole point of a 15-minute access token. The `type` claim both tokens
  // ! carry is the second line of defence, for when these two are accidentally set to the
  // ! same value in some environment. Neither has a default: a missing secret must fail
  // ! loudly, never fall back to something guessable.
  // ! The two token lifetimes are NOT here: they're literals in user.services.ts (spec 18 D3),
  // ! because @types/jsonwebtoken types `expiresIn` as ms.StringValue - a template-literal
  // ! union a `string | undefined` read from process.env can't satisfy.
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,

  openRouterApiKey: process.env.openRouterApiKey,
  integrationApiKey: process.env.INTEGRATION_API_KEY,
  // ! shared secret for the daily error-log cleanup cron (spec 17). Deliberately NOT
  // ! integrationApiKey: that one is shared with the bikelog project, a different trust boundary.
  cronSecret: process.env.CRON_SECRET,

  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
};
