import crypto from 'crypto';
import { put } from '@vercel/blob';
import { requireAuth } from '../../lib/auth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized — admin login required' });
  }

  try {
    const { filename, fileData, mimeType } = req.body || {};

    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({ error: 'No PDF data received' });
    }

    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const payload = Buffer.from(base64Data, 'base64');

    if (!payload || payload.length === 0) {
      return res.status(400).json({ error: 'PDF data is empty' });
    }

    if (payload.length > 20 * 1024 * 1024) {
      return res.status(413).json({ error: 'PDF is too large' });
    }

    // Without a Blob token (pure local dev), fall back to an inline data URL.
    let pdfUrl = `data:${mimeType || 'application/pdf'};base64,${base64Data}`;
    let storage = 'data-url';

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const folder = (process.env.BLOB_FOLDER || 'uploads').replace(/^\/+|\/+$/g, '');
      const safeName = (filename || 'uploaded.pdf').replace(/[^\w.\-]+/g, '_');
      // Content-hash the file so re-uploading the same PDF reuses the same blob
      // (idempotent) instead of piling up duplicates.
      const hash = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
      const remoteFilename = `${folder}/${hash}-${safeName}`;
      const uploadResult = await put(remoteFilename, payload, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mimeType || 'application/pdf',
      });
      // Private blobs aren't publicly fetchable, so serve them through our own
      // authenticated proxy route instead of the raw blob URL.
      pdfUrl = `/api/pdf?path=${encodeURIComponent(uploadResult.pathname)}`;
      storage = 'vercel-blob';
    }

    return res.status(200).json({
      success: true,
      pdfUrl,
      storage,
      filename: filename || 'uploaded.pdf',
    });
  } catch (err) {
    console.error('Upload PDF error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process PDF upload' });
  }
}
