## About
AWS Lambdaで動かすことを想定したアラートです。
Lineへ通知を送ります。

## Usage

1. Lambdaを作成
2. budgets:ViewBudget権限を付与
3. index.mjsを貼り付けてデプロイ
4. 環境変数に `ACCOUNT_ID` `LINE_TOKEN` を設定
5. トリガーを設定