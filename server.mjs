import express from "express";
import OpenAI from "openai";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "64kb" }));

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL:
    process.env.SILICONFLOW_BASE_URL ||
    "https://api.siliconflow.cn/v1",
});

const requestSchema = z.object({
  locale: z.string().max(50),
  userQuestion: z.string().max(500).nullable().optional(),

  health: z.object({
    steps: z.number().int().nonnegative(),
    stepGoal: z.number().int().positive(),
    activeEnergyKcal: z.number().int().nonnegative(),
    averageHeartRate: z.number().int().nonnegative(),
    restingHeartRate: z.number().int().nonnegative(),
    hrvMilliseconds: z.number().int().nonnegative(),
    sleepMinutes: z.number().int().nonnegative(),
    deepSleepMinutes: z.number().int().nonnegative(),
    remSleepMinutes: z.number().int().nonnegative(),
  }),

  preferences: z.object({
    sleepGoalMinutes: z.number().int().positive(),
    plannedBedtime: z.string().max(10),
    plannedWakeTime: z.string().max(10),
  }),
});

app.get("/", (_, res) => {
  res.json({
    ok: true,
    service: "Health Assistant AI Backend",
  });
});

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/health-analysis", async (req, res) => {
  try {
    const payload = requestSchema.parse(req.body);

    if (!process.env.SILICONFLOW_API_KEY) {
      throw new Error("服务器未配置 SILICONFLOW_API_KEY");
    }

    const prompt = `
你是一个谨慎、友好的健康生活方式助手。

请根据下面的健康数据，生成今天的健康日报。

要求：

1. 不诊断疾病。
2. 不替代医生。
3. 不根据单次数据判断疾病。
4. 如果指标需要关注，请使用"建议继续观察趋势"等表达。
5. 必须返回合法 JSON。
6. 不要返回 Markdown。
7. 不要返回代码块。
8. 不要返回 generatedAt 字段。

返回格式：

{
  "summary":"健康总结",
  "recommendations":[
    "建议1",
    "建议2"
  ],
  "cautions":[
    "注意事项1",
    "注意事项2"
  ]
}

用户健康数据：

${JSON.stringify(payload)}
`;

    const response = await client.chat.completions.create({
      model:
        process.env.SILICONFLOW_MODEL ||
        "deepseek-ai/DeepSeek-V3",

      messages: [
        {
          role: "system",
          content:
            "你是一名专业健康助手，只返回JSON，不返回Markdown。"
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.3,
      max_tokens: 1800,
    });

    const text =
      response.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("模型没有返回内容");
    }

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    // ==========================
    // 后端统一生成真实时间
    // ==========================

    const now = new Date();

    parsed.generatedAt = new Intl.DateTimeFormat(
      "zh-CN",
      {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }
    )
      .format(now)
      .replace(/\//g, "-");

    res.json(parsed);
  } catch (error) {
    console.error("Health analysis error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "提交的健康数据格式不正确",
        details: error.issues,
      });
    }

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "服务器请求失败",
    });
  }
});

const port = Number(process.env.PORT || 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(
    `Health AI backend listening on port ${port}`
  );
});
