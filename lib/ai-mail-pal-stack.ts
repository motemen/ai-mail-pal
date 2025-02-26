import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as ses from "aws-cdk-lib/aws-ses";
import * as s3notify from "aws-cdk-lib/aws-s3-notifications";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { AiMailPalStackProps } from "./types";

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

    // Lambda関数の共通設定
    // Lambda関数の作成
    const parseMailFunction = new lambda.Function(this, "ParseMailFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      environment: {
        OPENAI_SECRET_NAME: props.openAiSecretName,
        ENVIRONMENT: props.environment,
      },
      functionName: `${props.environment}-parse-mail`,
      handler: "functions/parse-mail.handler",
      code: lambda.Code.fromAsset("dist"),
    });

    const callOpenAiFunction = new lambda.Function(this, "CallOpenAiFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(1),
      environment: {
        OPENAI_SECRET_NAME: props.openAiSecretName,
        ENVIRONMENT: props.environment,
      },
      functionName: `${props.environment}-call-openai`,
      handler: "functions/call-openai.handler",
      code: lambda.Code.fromAsset("dist"),
    });

    const sendMailFunction = new lambda.Function(this, "SendMailFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      environment: {
        OPENAI_SECRET_NAME: props.openAiSecretName,
        ENVIRONMENT: props.environment,
      },
      functionName: `${props.environment}-send-mail`,
      handler: "functions/send-mail.handler",
      code: lambda.Code.fromAsset("dist"),
    });

    // Step Functions定義
    const parseMailTask = new tasks.LambdaInvoke(this, "Parse Mail", {
      lambdaFunction: parseMailFunction,
    });

    const callOpenAiTask = new tasks.LambdaInvoke(this, "Call OpenAI API", {
      lambdaFunction: callOpenAiFunction,
    });

    const waitTask = new sfn.Wait(this, "Random Delay", {
      time: sfn.WaitTime.secondsPath("$.waitSeconds"),
    });

    const sendMailTask = new tasks.LambdaInvoke(this, "Send Mail", {
      lambdaFunction: sendMailFunction,
    });

    // ステートマシンの定義
    const stateMachine = new sfn.StateMachine(
      this,
      "MailProcessingStateMachine",
      {
        definition: parseMailTask
          .next(callOpenAiTask)
          .next(waitTask)
          .next(sendMailTask),
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
    openAiSecret.grantRead(callOpenAiFunction);

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
