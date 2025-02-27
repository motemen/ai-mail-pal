import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as sfnTasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as s3notify from "aws-cdk-lib/aws-s3-notifications";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sesActions from "aws-cdk-lib/aws-ses-actions";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AiMailPalStackProps extends cdk.StackProps {
  /**
   * メールの受信ドメイン
   */
  mailRecipientDomain: string;

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

export class AiMailPalStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AiMailPalStackProps) {
    super(scope, id);

    // S3バケットの作成
    const mailBucket = new s3.Bucket(this, "MailBucket", {
      bucketName: props.mailBucketName,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // OpenAI APIキーの取得
    const openAiSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "OpenAiSecret",
      props.openAiSecretName
    );

    // SES受信ルールの作成
    // FIXME: これアカウントに1つなのでこのスタックで作るのは不適切
    new ses.ReceiptRuleSet(this, "MailRuleSet", {
      rules: [
        {
          recipients: [props.mailRecipientDomain],
          actions: [
            new sesActions.S3({
              bucket: mailBucket,
              objectKeyPrefix: "mail/",
            }),
          ],
        },
      ],
    });

    // Lambda関数の共通設定
    // Lambda関数の作成
    const parseMailFunction = new NodejsFunction(this, "ParseMailFunction", {
      entry: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src/functions/parse-mail.ts"
      ),
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      handler: "handler",
      environment: {
        OPENAI_SECRET_NAME: props.openAiSecretName,
        ENVIRONMENT: props.environment,
      },
      functionName: `ai-mail-pal-${props.environment}-parse-mail`,
    });

    const composeReplyFunction = new NodejsFunction(
      this,
      "ComposeReplyFunction",
      {
        entry: path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../src/functions/compose-reply.ts"
        ),
        runtime: lambda.Runtime.NODEJS_20_X,
        architecture: lambda.Architecture.ARM_64,
        timeout: cdk.Duration.minutes(1),
        handler: "handler",
        environment: {
          OPENAI_SECRET_NAME: props.openAiSecretName,
          ENVIRONMENT: props.environment,
        },
        functionName: `ai-mail-pal-${props.environment}-compose-reply`,
      }
    );

    const sendMailFunction = new NodejsFunction(this, "SendMailFunction", {
      entry: path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src/functions/send-mail.ts"
      ),
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      handler: "handler",
      environment: {
        OPENAI_SECRET_NAME: props.openAiSecretName,
        ENVIRONMENT: props.environment,
      },
      functionName: `ai-mail-pal-${props.environment}-send-mail`,
    });

    // Step Functions定義
    const composeReplyTask = new sfnTasks.LambdaInvoke(this, "Compose Reply", {
      lambdaFunction: composeReplyFunction,
    });

    const waitTask = new sfn.Wait(this, "Random Delay", {
      time: sfn.WaitTime.secondsPath("$.waitSeconds"),
    });

    const sendMailTask = new sfnTasks.LambdaInvoke(this, "Send Mail", {
      lambdaFunction: sendMailFunction,
    });

    // ステートマシンの定義
    const stateMachineChain = composeReplyTask
      .next(waitTask)
      .next(sendMailTask);

    const stateMachine = new sfn.StateMachine(
      this,
      "MailProcessingStateMachine",
      {
        definitionBody:
          sfn.ChainDefinitionBody.fromChainable(stateMachineChain),
        stateMachineName: `${props.environment}-mail-processing`,
        timeout: cdk.Duration.hours(24),
      }
    );

    // S3トリガーの設定
    mailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notify.LambdaDestination(parseMailFunction)
    );

    // Step Functionsのトリガー設定
    parseMailFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["states:StartExecution"],
        resources: [stateMachine.stateMachineArn],
      })
    );

    // 必要なIAMポリシーの付与
    mailBucket.grantRead(parseMailFunction);
    openAiSecret.grantRead(composeReplyFunction);

    // SES権限の付与
    sendMailFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"], // 本番環境では適切なARNに制限すること
      })
    );

    // 出力の定義
    new cdk.CfnOutput(this, "StateMachineArn", {
      value: stateMachine.stateMachineArn,
      description: "Mail Processing State Machine ARN",
    });
  }
}
