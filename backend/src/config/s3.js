import { S3Client } from "@aws-sdk/client-s3";

const {
  S3_ENDPOINT,
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

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

console.log("✅ S3 connected to:", S3_ENDPOINT);

export default s3Client;