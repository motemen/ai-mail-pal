import { AppConfig } from "../types/config";
import defaultConfig from "../../config/default.json";

/**
 * リポジトリ内の設定ファイルを読み込む
 *
 * 設定ファイルはリポジトリ内の config/default.json に配置されており、
 * ビルド時にバンドルされる
 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    // 型キャストを行い、設定ファイルをAppConfig型として返す
    return defaultConfig as AppConfig;
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
