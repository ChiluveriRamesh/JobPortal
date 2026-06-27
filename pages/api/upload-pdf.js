import fs from 'fs';
import path from 'path';
import multer from 'multer';

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '20mb',
  },
};

const uploadDir = path.join(process.cwd(), 'public', 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
    const ext = path.extname(safeName) || '.pdf';
    const base = path.basename(safeName, ext);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
}).single('pdf');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Failed to upload PDF' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file received' });
    }

    const pdfUrl = `/uploads/${req.file.filename}`;
    return res.status(200).json({
      success: true,
      pdfUrl,
      filename: req.file.originalname,
    });
  });
}
