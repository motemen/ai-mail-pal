/**
 * 返信遅延時間の設定（秒）
 */
export interface DelayConfig {
  /** 最小遅延時間 */
  min: number;
  /** 最大遅延時間 */
  max: number;
}

/**
 * メールアドレスのローカルパートごとの設定
 */
export interface LocalPartConfig {
  /** システムプロンプト */
  systemPrompt: string;
  /** メール署名 */
  signature: string;
  /** 返信遅延時間の設定（オプション） */
  delay?: DelayConfig;
  /** OpenAIのモデル（オプション） */
  model?: string;
}

/**
 * アプリケーション全体の設定
 */
export interface AppConfig {
  /** ローカルパートごとの設定 */
  prompts: {
    [localPart: string]: LocalPartConfig;
  };
  /** デフォルト設定 */
  default: LocalPartConfig;
  /** デフォルトの返信遅延時間の設定（秒） */
  delay: DelayConfig;
}
