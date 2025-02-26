import * as esbuild from "esbuild";

// Lambda関数のリスト
const functions = ["parse-mail", "call-openai", "send-mail"];

// 各関数をビルド
for (const func of functions) {
  await esbuild.build({
    entryPoints: [`src/functions/${func}.ts`],
    bundle: true,
    outfile: `dist/functions/${func}.js`,
    platform: "node",
    target: "node20",
    format: "cjs",
    external: [
      // AWS SDKはLambdaランタイムに含まれているのでバンドルから除外
      "@aws-sdk/*",
    ],
    minify: true,
    sourcemap: true,
  });
}

console.log("Build completed");
