import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../config/s3.js";

ffmpeg.setFfmpegPath(ffmpegPath);

const BUCKET = "videos";

export const uploadVideoToS3 = async (file, key) => {
  return new Promise((resolve, reject) => {
    ffmpeg(file.buffer)
      .ffprobe((err, metadata) => {
        if (err) return reject(err);

        const duration = metadata.format.duration;

        if (duration > 300) {
          return reject(new Error("Video exceeds 5 minutes"));
        }

        s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: file.buffer,
          })
        )
          .then(() => resolve({ key, duration }))
          .catch(reject);
      });
  });
};