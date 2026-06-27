import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../../lib/auth";
import { hashText, readParseCache, writeParseCache } from "../../lib/blob-cache";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const PARSE_PROMPT = `You are a government job notification parser for India. Extract ALL job listings from this text and return a JSON array. Each job object must have these exact fields:
{
  "title": "Job title/post name",
  "department": "Organization/Department name",
  "state": "State name — MUST be one of: Central Government, Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chhattisgarh, Goa, Gujarat, Haryana, Himachal Pradesh, Jharkhand, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Manipur, Meghalaya, Mizoram, Nagaland, Odisha, Punjab, Rajasthan, Sikkim, Tamil Nadu, Telangana, Tripura, Uttar Pradesh, Uttarakhand, West Bengal, Delhi, Jammu & Kashmir, Ladakh, Puducherry, Chandigarh",
  "education": "MUST be one of: 8th Pass, 10th Pass, 12th Pass, ITI / Vocational, Diploma / B.Tech, BE, 10+2, Graduate, B.Sc Nursing, B.Sc Agriculture, Graduate (Commerce), B.Ed / D.El.Ed, Post Graduate, PhD",
  "type": "MUST be one of: Group A, Group B, Group C, Group D, Banking, Teaching, Medical / Healthcare, Technical, Defence & Paramilitary, State Police, Finance / Accounts, State PSC, Agriculture, Doctor, Teacher, Scientist, Engineering, Research, Administrative, Clerical, Lecturers, Education, Other",
  "payScale": "Pay scale as string e.g. ₹35,000 - ₹1,10,000",
  "vacancies": <integer — total vacancies>,
  "lastDate": "YYYY-MM-DD",
  "icon": "Single relevant emoji",
  "notifNo": "Notification number or reference code",
  "ageLimit": "Age limit string e.g. 18-75 years",
  "selectionProcess": "Brief selection steps",
  "description": "A concise 2-3 sentence summary of the job vacancy for applicants",
  "applicationLink": "Direct link to the official application page or PDF"
  
}

If multiple posts exist, include all as separate objects.
Defaults if unknown: lastDate → 2025-12-31, vacancies → 1, state → Central Government.
Return ONLY a valid JSON array — no markdown fences, no explanation.`;

function buildFallbackJobs(text, filename) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  const titleCandidate = normalized
    .split(/[.\n:]+/)
    .find((line) => /post|recruitment|notification|exam|vacancy/i.test(line) && line.length < 120);

  const title = titleCandidate ? titleCandidate.trim() : filename || "Government Job Notification";
  const description = `This notification outlines ${title} details including eligibility, vacancies, salary, and the application deadline. Review the uploaded PDF for the full official instructions and selection process.`;

  return [
    {
      title,
      department: "Department details in PDF",
      state: "Central Government",
      education: "Graduate",
      type: "Group C",
      payScale: "As per notification",
      vacancies: 1,
      lastDate: "2025-12-31",
      icon: "📄",
      notifNo: "See PDF",
      ageLimit: "As per notification",
      selectionProcess: "As per notification",
      description,
      fromPdf: true,
    },
  ];
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Parsing calls the paid Claude API, so it is admin-only to prevent abuse.
  if (!requireAuth(req)) {
    return res.status(401).json({ error: "Unauthorized — admin login required" });
  }

  try {
    const { text, filename } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "No text provided" });
    }

    if (!client) {
      const fallbackJobs = buildFallbackJobs(text, filename);
      return res.status(200).json({ jobs: fallbackJobs, count: fallbackJobs.length });
    }

    const truncated = text.substring(0, 7000);

    // If we've already parsed this exact content, reuse it instead of paying
    // for another Claude call.
    const cacheKey = hashText(truncated);
    const cached = await readParseCache(cacheKey);
    if (cached) {
      return res.status(200).json({ jobs: cached, count: cached.length, cached: true });
    }

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
      const fallbackJobs = buildFallbackJobs(text, filename);
      return res.status(200).json({ jobs: fallbackJobs, count: fallbackJobs.length });
    }

    jobs = jobs.map((j) => ({
      ...j,
      description:
        j.description ||
        `This notification outlines ${j.title || "the advertised vacancy"} with details on eligibility, salary, and application deadline. Review the official PDF for complete instructions.`,
      vacancies: parseInt(j.vacancies) || 1,
      fromPdf: true,
    }));

    // Cache the parsed result so re-uploading the same PDF skips the AI call.
    await writeParseCache(cacheKey, jobs);

    return res.status(200).json({ jobs, count: jobs.length });
  } catch (err) {
    console.error("Parse API error:", err);
    const fallbackJobs = buildFallbackJobs(req.body?.text || "", req.body?.filename);
    return res.status(200).json({ jobs: fallbackJobs, count: fallbackJobs.length });
  }
}
