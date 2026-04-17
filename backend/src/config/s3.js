import { S3Client } from "@aws-sdk/client-s3";

const {
  S3_ENDPOINT,
  S3_PUBLIC_ENDPOINT,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_REGION,
} = process.env;

// ✅ validate all required env vars
if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
  throw new Error(
    "Missing S3 env vars. Required: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY"
  );
}

const shared = {
  region: S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
};

/** Server → MinIO (Docker network hostname, e.g. http://minio:9000) */
const s3Client = new S3Client({
  ...shared,
  endpoint: S3_ENDPOINT,
});

/**
 * Same credentials, host the browser can reach (e.g. http://localhost:9000).
 * Presigned URLs must be signed for this host or signatures fail in the browser.
 */
const s3PresignClient = new S3Client({
  ...shared,
  endpoint: S3_PUBLIC_ENDPOINT || S3_ENDPOINT,
});

console.log("✅ S3 connected to:", S3_ENDPOINT);
if (S3_PUBLIC_ENDPOINT && S3_PUBLIC_ENDPOINT !== S3_ENDPOINT) {
  console.log("✅ S3 presigned URLs use:", S3_PUBLIC_ENDPOINT);
}

export default s3Client;
export { s3PresignClient };