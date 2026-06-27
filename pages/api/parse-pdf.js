import Anthropic from "@anthropic-ai/sdk";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PARSE_PROMPT = `You are a government job notification parser for India. Extract ALL job listings from this text and return a JSON array. Each job object must have these exact fields:
{
  "title": "Job title/post name",
  "department": "Organization/Department name",
  "state": "State name — MUST be one of: Central Government, Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chhattisgarh, Goa, Gujarat, Haryana, Himachal Pradesh, Jharkhand, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Manipur, Meghalaya, Mizoram, Nagaland, Odisha, Punjab, Rajasthan, Sikkim, Tamil Nadu, Telangana, Tripura, Uttar Pradesh, Uttarakhand, West Bengal, Delhi, Jammu & Kashmir, Ladakh, Puducherry, Chandigarh",
  "education": "MUST be one of: 8th Pass, 10th Pass, 12th Pass, ITI / Vocational, Diploma / B.Tech, Graduate, B.Sc Nursing, B.Sc Agriculture, Graduate (Commerce), B.Ed / D.El.Ed, Post Graduate, PhD",
  "type": "MUST be one of: Group A, Group B, Group C, Group D, Banking, Teaching, Medical / Healthcare, Technical, Defence & Paramilitary, State Police, Finance / Accounts, State PSC, Agriculture",
  "payScale": "Pay scale as string e.g. ₹35,000 – ₹1,10,000",
  "vacancies": <integer — total vacancies>,
  "lastDate": "YYYY-MM-DD",
  "icon": "Single relevant emoji",
  "notifNo": "Notification number or reference code",
  "ageLimit": "Age limit string e.g. 18–35 years",
  "selectionProcess": "Brief selection steps"
}

If multiple posts exist, include all as separate objects.
Defaults if unknown: lastDate → 2025-12-31, vacancies → 1, state → Central Government.
Return ONLY a valid JSON array — no markdown fences, no explanation.`;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res
      .status(500)
      .json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }

  try {
    const { text, filename } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "No text provided" });
    }

    const truncated = text.substring(0, 7000);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `${PARSE_PROMPT}\n\nPDF text from "${filename || "notification.pdf"}":\n${truncated}`,
        },
      ],
    });

    const rawText = message.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");

    let jobs;
    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      jobs = JSON.parse(clean);
      if (!Array.isArray(jobs)) jobs = [jobs];
    } catch {
      return res
        .status(422)
        .json({ error: "Could not parse AI response as JSON", raw: rawText });
    }

    // Sanitise
    jobs = jobs.map((j) => ({
      ...j,
      vacancies: parseInt(j.vacancies) || 1,
      fromPdf: true,
    }));

    return res.status(200).json({ jobs, count: jobs.length });
  } catch (err) {
    console.error("Parse API error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
}
