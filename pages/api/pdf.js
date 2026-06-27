import { get } from '@vercel/blob';

// Streams a privately-stored PDF from Vercel Blob to the browser. The blob
// store is private, so the raw blob URL can't be opened directly — this route
// reads it server-side with the read-write token and pipes the bytes back.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path' });
  }

  // Only allow serving files from the configured uploads folder — never jobs.json
  // or anything outside it.
  const folder = (process.env.BLOB_FOLDER || 'uploads').replace(/^\/+|\/+$/g, '');
  // Only serve PDFs directly under the uploads folder — never jobs.json or the
  // parse cache (cache/*.json).
  if (
    path.includes('..') ||
    !path.startsWith(`${folder}/`) ||
    path.includes('/cache/') ||
    !path.toLowerCase().endsWith('.pdf')
  ) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Blob storage not configured' });
  }

  try {
    const result = await get(path, { access: 'private' });
    if (!result || !result.stream) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, max-age=300');
    const filename = path.split('/').pop() || 'notification.pdf';
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Pipe the web ReadableStream to the Node response.
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error('PDF proxy error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load PDF' });
  }
}
