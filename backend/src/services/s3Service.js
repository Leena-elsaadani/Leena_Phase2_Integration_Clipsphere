/**
 * services/s3Service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps all MinIO / S3 operations:
 *   - generateUploadURL()    → presigned PUT URL for direct browser uploads
 *   - generateDownloadURL()  → presigned GET URL for secure video playback
 *   - uploadBuffer()         → server-side stream upload (used by pipeline)
 *   - deleteObject()         → clean up after failed transactions
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Client, { s3PresignClient } from "../config/s3.js";
import { Readable } from "stream";

const BUCKET = process.env.MINIO_BUCKET || "videos";
const UPLOAD_EXPIRY = parseInt(process.env.MINIO_UPLOAD_URL_EXPIRY || "300", 10);
const DOWNLOAD_EXPIRY = parseInt(process.env.MINIO_DOWNLOAD_URL_EXPIRY || "3600", 10);

/**
 * Generate a presigned PUT URL so the client can upload directly to MinIO.
 * @param {string} objectKey  - Unique key for the object (e.g. "videos/uuid.mp4")
 * @param {string} contentType - MIME type (e.g. "video/mp4")
 * @returns {Promise<string>} Presigned upload URL
 */
async function generateUploadURL(objectKey, contentType = "video/mp4") {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: UPLOAD_EXPIRY });
}

/**
 * Generate a presigned GET URL for secure video streaming / download.
 * @param {string} objectKey
 * @returns {Promise<string>} Presigned download URL
 */
async function generateDownloadURL(objectKey) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
  });
  return getSignedUrl(s3Client, command, { expiresIn: DOWNLOAD_EXPIRY });
}

/**
 * Upload a Buffer or Readable stream directly from the server.
 * Used by the video upload pipeline after ffprobe validation.
 * @param {string} objectKey
 * @param {Buffer|Readable} body
 * @param {string} contentType
 */
async function uploadBuffer(objectKey, body, contentType = "video/mp4") {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    Body: body,
    ContentType: contentType,
  });
  return s3Client.send(command);
}

/**
 * Delete an object from MinIO (used for cleanup on failed uploads).
 * @param {string} objectKey
 */
async function deleteObject(objectKey) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
  });
  return s3Client.send(command);
}

export {
  generateUploadURL,
  generateDownloadURL,
  uploadBuffer,
  deleteObject,
};