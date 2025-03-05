import { CostExplorer } from "@aws-sdk/client-cost-explorer";
import { Budgets } from "@aws-sdk/client-budgets";

const ACCOUNT_ID = process.env.ACCOUNT_ID;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_ENDPOINT = "https://api.line.me/v2/bot/message/broadcast";

export const handler = async (event) => {
  const ce = new CostExplorer({ region: "us-east-1" });

  const budgets = new Budgets({
    region: "us-east-1",
  });

  // 一番低い予算を取得
  const budgetsResponse = await budgets.describeBudgets({
    AccountId: ACCOUNT_ID,
    MaxResults: 100,
  });
  const budgetAmounts = budgetsResponse.Budgets.map((budget) => ({
    amount: parseFloat(budget.BudgetLimit.Amount),
    unit: budget.BudgetLimit.Unit,
    name: budget.BudgetName,
  }));
  const lowestBudget = budgetAmounts.sort((a, b) => a.amount - b.amount)[0];
  console.log("lowestBudget: ", lowestBudget);

  // 今月の請求額を取得
  const date = new Date();
  const startDate = `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-01`;
  // 終了日を翌日に設定（1日に実行した場合のエラー回避のため）
  date.setDate(date.getDate() + 1);
  const endDate = date.toISOString().split("T")[0];

  console.log("start-date:", startDate, ", end-date:", endDate);

  const costData = await ce.getCostAndUsage({
    TimePeriod: {
      Start: startDate,
      End: endDate,
    },
    Granularity: "MONTHLY",
    //  GroupBy: [
    //   {
    //     Type: 'DIMENSION',
    //     Key: 'SERVICE'  // サービスごとにグループ化
    //   }
    // ],
    Metrics: ["UnblendedCost"],
  });
  console.log("costData: ", JSON.stringify(costData, null, 2));

  const cost = costData.ResultsByTime[0].Total.UnblendedCost.Amount;
  const isNotified = cost > lowestBudget.amount;

  const message = isNotified
    ? `予算を超えています!\n今月のAWS利用料金は${Number(cost).toFixed(
        2
      )}ドルです。`
    : `今月のAWS利用料金は${Number(cost).toFixed(2)}ドルです`;
  console.log("isNotified: ", isNotified);

  const response = {
    statusCode: 200,
    body: JSON.stringify(message),
  };

  // 予算を超えていない場合、Line通知は送らない
  if (!isNotified) return response;

  // LINE送信
  const lineResponse = await fetch(LINE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          type: "text",
          text: message,
        },
      ],
    }),
  });

  if (!lineResponse.ok) {
    throw new Error(
      `LINE API Error: ${lineResponse.status} ${lineResponse.statusText}`
    );
  }

  const lineResponseData = await lineResponse.json();
  console.log("LINE送信成功:", lineResponse.status, lineResponseData);

  return {
    statusCode: 200,
    body: message,
  };

  return response;
};
