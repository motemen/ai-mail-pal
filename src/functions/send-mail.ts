import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { MailProcessState } from "../types/mail";
import { loadConfig, getLocalPart, formatError } from "../utils/config";

/**
 * 返信の件名を生成
 */
function generateReplySubject(originalSubject: string): string {
  const prefix = "Re:";
  if (originalSubject.startsWith(prefix)) {
    return originalSubject;
  }
  return `${prefix} ${originalSubject}`;
}

/**
 * メール本文を生成
 */
function generateMailBody(
  response: string,
  signature: string,
  originalFrom: string,
  originalBody: string
): string {
  const date = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  return `${response}

-- 
${signature}

${date} ${originalFrom}:

> ${originalBody.replace(/\n/g, "\n> ")}`;
}

/**
 * SESを使用してメールを送信
 */
async function sendMail(
  from: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const sesClient = new SESClient({});

  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: [to],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: body,
              Charset: "UTF-8",
            },
          },
        },
      })
    );
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

/**
 * Lambda関数のハンドラー
 */
export const handler = async (event: {
  parsedMail: MailProcessState["parsedMail"];
  openAiResponse: string;
  waitSeconds: number;
}): Promise<void> => {
  try {
    // 設定の読み込み
    const config = await loadConfig();

    // メールアドレスのローカルパートを取得
    const localPart = getLocalPart(event.parsedMail.to[0]);
    const promptConfig = config.prompts[localPart] || config.default;

    // 返信の件名を生成
    const replySubject = generateReplySubject(event.parsedMail.subject);

    // メール本文を生成
    const mailBody = generateMailBody(
      event.openAiResponse,
      promptConfig.signature,
      event.parsedMail.from,
      event.parsedMail.text
    );

    // メールを送信
    await sendMail(
      event.parsedMail.to[0], // 受信したメールアドレスから送信
      event.parsedMail.from, // 元の送信者に返信
      replySubject,
      mailBody
    );

    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error in send-mail handler:", error);
    throw {
      ...event,
      error: formatError(error),
    };
  }
};
