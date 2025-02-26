#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AiMailPalStack } from "../lib/ai-mail-pal-stack";

const app = new cdk.App();

// 環境変数から設定を読み込む
const environment = process.env.ENVIRONMENT || "dev";
const mailBucketName =
  process.env.MAIL_BUCKET_NAME || `ai-mail-pal-mail-${environment}`;
const openAiSecretName =
  process.env.OPENAI_SECRET_NAME || "ai-mail-pal/openai-api-key";

// スタックの作成
new AiMailPalStack(app, `AiMailPalStack-${environment}`, {
  environment,
  mailBucketName,
  openAiSecretName,
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

app.synth();
