/**
 * メールアドレスのローカルパートごとの設定
 */
export interface LocalPartConfig {
  /** システムプロンプト */
  systemPrompt: string;
  /** メール署名 */
  signature: string;
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
  /** 返信遅延時間の設定（秒） */
  delay: {
    /** 最小遅延時間 */
    min: number;
    /** 最大遅延時間 */
    max: number;
  };
}
