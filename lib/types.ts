import * as cdk from "aws-cdk-lib";

export interface AiMailPalStackProps extends cdk.StackProps {
  /**
   * 設定ファイルを保存するS3バケット名
   */
  configBucketName: string;

  /**
   * メール受信用のS3バケット名
   */
  mailBucketName: string;

  /**
   * OpenAI APIキー（SecretsManagerから取得）
   */
  openAiSecretName: string;

  /**
   * 環境名（dev/prod等）
   */
  environment: string;
}
