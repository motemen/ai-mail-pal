import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import OpenAI from "openai";
import { MailProcessState } from "../types/mail";
import { loadConfig, getLocalPart, formatError } from "../utils/config";

/**
 * SecretsManagerからOpenAI APIキーを取得
 */
async function getOpenAiApiKey(): Promise<string> {
  const client = new SecretsManagerClient({});
  const secretName = process.env.OPENAI_SECRET_NAME;

  if (!secretName) {
    throw new Error("OPENAI_SECRET_NAME environment variable is not set");
  }

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    return response.SecretString;
  } catch (error) {
    console.error("Failed to get OpenAI API key:", error);
    throw error;
  }
}

/**
 * メールの内容からプロンプトを生成
 */
function generatePrompt(text: string, subject: string, from: string): string {
  return `以下のメールに対して返信してください：

差出人: ${from}
件名: ${subject}

${text}

返信の本文のみを記載してください。件名は自動的に設定されます。`;
}

/**
 * OpenAI APIを使用して返信を生成
 */
async function generateReply(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string = "gpt-4o-mini" // デフォルトモデルを指定
): Promise<string> {
  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  const reply = response.choices[0]?.message?.content;
  if (!reply) {
    throw new Error("OpenAI API returned empty response");
  }

  return reply;
}

/**
 * Lambda関数のハンドラー
 */
export const handler = async (
  event: MailProcessState
): Promise<MailProcessState> => {
  try {
    // 設定の読み込み
    const config = await loadConfig();
    const apiKey = await getOpenAiApiKey();

    // メールアドレスのローカルパートを取得
    const localPart = getLocalPart(event.parsedMail.to[0]);

    // システムプロンプトを選択
    const promptConfig = config.prompts[localPart] || config.default;

    // プロンプトを生成
    const userPrompt = generatePrompt(
      event.parsedMail.text,
      event.parsedMail.subject,
      event.parsedMail.from
    );

    // OpenAI APIを呼び出して返信を生成
    const openAiResponse = await generateReply(
      apiKey,
      promptConfig.systemPrompt,
      userPrompt,
      promptConfig.model // 設定からモデルを取得
    );

    return {
      parsedMail: event.parsedMail,
      openAiResponse,
      waitSeconds: event.waitSeconds,
    };
  } catch (error) {
    console.error("Error in call-openai handler:", error);
    throw {
      ...event,
      error: formatError(error),
    };
  }
};
