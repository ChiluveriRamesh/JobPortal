import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    let pdfUrl = `data:${mimeType || 'application/pdf'};base64,${base64Data}`;
    let storage = 'data-url';

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const folder = (process.env.BLOB_FOLDER || 'uploads').replace(/^\/+|\/+$/g, '')
      const remoteFilename = `${folder}/${filename || 'uploaded.pdf'}`
      const uploadResult = await put(remoteFilename, payload, {
        access: 'public',
        contentType: mimeType || 'application/pdf'
      });
      pdfUrl = uploadResult.url;
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
