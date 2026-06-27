export default function handler(req, res) {
  res.status(200).json({
    status: "ok",
    service: "Sarkari Naukri API",
    version: "1.0.0",
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
}
