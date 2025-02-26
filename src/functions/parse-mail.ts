import {
  GetObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { simpleParser } from "mailparser";
import { ParsedMail, MailProcessState } from "../types/mail";
import { loadConfig, generateRandomDelay, formatError } from "../utils/config";

/**
 * S3からメールを読み込む
 */
async function loadMailFromS3(bucket: string, key: string): Promise<string> {
  const s3Client = new S3Client({});
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    const mailContent = await response.Body?.transformToString();
    if (!mailContent) {
      throw new Error("Mail content is empty");
    }

    return mailContent;
  } catch (error) {
    if (error instanceof S3ServiceException) {
      console.error("Failed to load mail from S3:", error);
      throw error;
    }
    throw error;
  }
}

/**
 * メールをパースして必要な情報を抽出
 */
async function parseMailContent(content: string): Promise<ParsedMail> {
  const parsed = await simpleParser(content);

  return {
    from: Array.isArray(parsed.from)
      ? parsed.from[0].text
      : parsed.from?.text || "",
    to: Array.isArray(parsed.to)
      ? parsed.to.map((addr) => addr.text)
      : [parsed.to?.text || ""],
    cc: parsed.cc
      ? Array.isArray(parsed.cc)
        ? parsed.cc.map((addr) => addr.text)
        : [parsed.cc.text]
      : undefined,
    subject: parsed.subject || "",
    text: parsed.text || "",
    html: parsed.html || undefined,
    attachments: parsed.attachments.map((att: any) => ({
      filename: att.filename || "unnamed",
      contentType: att.contentType || "application/octet-stream",
      content: att.content.toString("base64"),
    })),
    messageId: parsed.messageId || "",
    date: parsed.date || new Date(),
  };
}

/**
 * Step Functionsのステートマシンを開始
 */
async function startStateMachine(
  stateMachineArn: string,
  input: MailProcessState
): Promise<void> {
  const sfnClient = new SFNClient({});
  try {
    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn,
        input: JSON.stringify(input),
      })
    );
  } catch (error) {
    console.error("Failed to start state machine:", error);
    throw error;
  }
}

/**
 * Lambda関数のハンドラー
 */
interface S3Event {
  Records: {
    s3: {
      bucket: {
        name: string;
      };
      object: {
        key: string;
      };
    };
  }[];
}

export const handler = async (
  event: S3Event
): Promise<{
  statusCode: number;
  body: string;
}> => {
  try {
    // 設定の読み込み
    const config = await loadConfig();

    // S3イベントからバケット名とキーを取得
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key);

    // メールの読み込みとパース
    const mailContent = await loadMailFromS3(bucket, key);
    const parsedMail = await parseMailContent(mailContent);

    // ランダムな遅延時間の生成
    const waitSeconds = generateRandomDelay(config.delay.min, config.delay.max);

    // Step Functionsの入力データを作成
    const input: MailProcessState = {
      parsedMail,
      waitSeconds,
    };

    // Step Functionsの開始
    const stateMachineArn = process.env.STATE_MACHINE_ARN;
    if (!stateMachineArn) {
      throw new Error("STATE_MACHINE_ARN environment variable is not set");
    }

    await startStateMachine(stateMachineArn, input);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successfully started mail processing",
        messageId: parsedMail.messageId,
      }),
    };
  } catch (error) {
    console.error("Error in parse-mail handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: formatError(error),
      }),
    };
  }
};
