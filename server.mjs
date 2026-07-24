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
你是一个谨慎、友好的健康生活方式助手。请基于以下健康摘要，用简体中文生成健康日报。

要求：
1. 不诊断疾病。
2. 不声称替代医生。
3. 不把单次可穿戴设备数据解释为确定疾病。
4. 若数据值得关注，应使用“建议关注趋势”或“如伴随不适请咨询医疗机构”等表述。
5. 严格返回有效 JSON，不要输出 Markdown，不要输出代码块。

返回结构：
{
  "summary": "一段不超过180字的总结",
  "recommendations": ["最多4条具体建议"],
  "cautions": ["最多3条需要注意的事项"],
  "generatedAt": "ISO-8601时间"
}

用户数据：
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
            "你是一名谨慎、专业的健康信息助手。只输出有效JSON，不输出Markdown，不提供医疗诊断或替代医生的结论。",
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
      throw new Error("模型没有返回文本");
    }

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

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
