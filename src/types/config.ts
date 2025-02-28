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
 * OpenAI APIの設定
 */
export interface OpenAIConfig {
  /** 使用するモデル */
  model: string;
  /** 生成時の温度パラメータ（0.0〜1.0） */
  temperature: number;
  /** 最大トークン数 */
  maxTokens: number;
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
  /** OpenAI APIの設定（オプション） */
  openai?: Partial<OpenAIConfig>;
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
