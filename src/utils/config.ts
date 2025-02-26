import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AppConfig } from "../types/config";

/**
 * S3から設定ファイルを読み込む
 */
export async function loadConfig(): Promise<AppConfig> {
  const s3Client = new S3Client({});
  const configBucket = process.env.CONFIG_BUCKET;

  if (!configBucket) {
    throw new Error("CONFIG_BUCKET environment variable is not set");
  }

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: configBucket,
        Key: "default.json",
      })
    );

    const configString = await response.Body?.transformToString();
    if (!configString) {
      throw new Error("Config file is empty");
    }

    return JSON.parse(configString) as AppConfig;
  } catch (error) {
    console.error("Failed to load config:", error);
    throw error;
  }
}

/**
 * メールアドレスからローカルパートを抽出する
 */
export function getLocalPart(email: string): string {
  return email.split("@")[0];
}

/**
 * ランダムな遅延時間を生成する
 */
export function generateRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * エラーメッセージを生成する
 */
export function formatError(error: unknown): {
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: String(error),
  };
}
