/**
 * メール処理に関する型定義
 */

/** メールの添付ファイル */
export interface Attachment {
  /** ファイル名 */
  filename: string;
  /** Content-Type */
  contentType: string;
  /** ファイルの内容（Base64） */
  content: string;
}

/** メールの内容 */
export interface ParsedMail {
  /** 送信者のメールアドレス */
  from: string;
  /** 受信者のメールアドレス */
  to: string[];
  /** CCのメールアドレス */
  cc?: string[];
  /** 件名 */
  subject: string;
  /** 本文（プレーンテキスト） */
  text: string;
  /** 本文（HTML） */
  html?: string;
  /** 添付ファイル */
  attachments?: Attachment[];
  /** メッセージID */
  messageId: string;
  /** 受信日時 */
  date: Date;
}

/** Step Functions用の状態データ */
export interface MailProcessState {
  /** 解析済みメール */
  parsedMail: ParsedMail;
  /** OpenAIの応答 */
  openAiResponse?: string;
  /** 遅延時間（秒） */
  waitSeconds: number;
  /** エラー情報 */
  error?: {
    message: string;
    stack?: string;
  };
}
