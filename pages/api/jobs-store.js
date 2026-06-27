import { get, put } from '@vercel/blob'
import { promises as fs } from 'fs'
import { join } from 'path'
import { requireAuth } from '../../lib/auth'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const folder = (process.env.BLOB_FOLDER || 'uploads').replace(/^\/*|\/*$/g, '')
const jobsPath = `${folder}/jobs.json`
const localDataDir = join(process.cwd(), '.data')
const localJobsFile = join(localDataDir, 'jobs.json')

// This Vercel Blob store is configured for PRIVATE access. We read/write via
// the SDK with the read-write token (never an unauthenticated public URL),
// so reads always work and are never served stale from a CDN edge.
const BLOB_ACCESS = 'private'

async function streamToString(stream) {
  // The SDK returns a web ReadableStream; read it fully into a string.
  if (stream && typeof stream.getReader === 'function') {
    const reader = stream.getReader()
    const chunks = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(typeof value === 'string' ? Buffer.from(value) : Buffer.from(value))
    }
    return Buffer.concat(chunks).toString('utf-8')
  }
  // Fallback for Node Readable (async iterable)
  const chunks = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf-8')
}

async function loadJobsFromBlob() {
  const result = await get(jobsPath, { access: BLOB_ACCESS })
  if (!result || !result.stream) return null
  const body = await streamToString(result.stream)
  const parsed = JSON.parse(body)
  return Array.isArray(parsed) ? parsed : null
}

async function saveJobsToBlob(jobs) {
  await put(jobsPath, JSON.stringify(jobs), {
    access: BLOB_ACCESS,
    contentType: 'application/json',
    // Overwrite the SAME file each time so reads find it; v2 requires this
    // explicitly, otherwise it throws on an existing pathname.
    addRandomSuffix: false,
    allowOverwrite: true,
    // No CDN caching — every reader sees the latest write immediately.
    cacheControlMaxAge: 0,
  })
}

async function ensureDataDir() {
  try {
    await fs.mkdir(localDataDir, { recursive: true })
  } catch (err) {
    console.warn('Could not create .data directory:', err.message)
  }
}

async function loadJobsFromFile() {
  try {
    await ensureDataDir()
    const content = await fs.readFile(localJobsFile, 'utf-8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('Could not load local jobs file:', err.message)
    return []
  }
}

async function saveJobsToFile(jobs) {
  try {
    await ensureDataDir()
    await fs.writeFile(localJobsFile, JSON.stringify(jobs, null, 2))
  } catch (err) {
    console.warn('Could not save local jobs file:', err.message)
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN
  console.log('[API] Jobs store', req.method, '| Blob token:', hasToken ? 'YES' : 'NO')

  if (req.method === 'GET') {
    try {
      if (hasToken) {
        try {
          console.log('[API] Reading blob at:', jobsPath)
          const jobs = await loadJobsFromBlob()
          if (jobs) {
            console.log('[API] Loaded', jobs.length, 'jobs from Blob')
            return res.status(200).json({ jobs, storage: 'blob', found: true })
          }
          console.log('[API] No blob found yet')
        } catch (err) {
          console.warn('[API] Blob read failed, falling back to local file:', err.message)
        }
      }

      // Fall back to local file-based storage (local dev only — Vercel FS is ephemeral)
      const jobs = await loadJobsFromFile()
      console.log('[API] Loaded', jobs.length, 'jobs from local file')
      return res.status(200).json({ jobs, storage: 'file', found: jobs.length > 0 })
    } catch (err) {
      console.error('[API] Jobs store GET error:', err)
      return res.status(500).json({ error: err.message || 'Unable to load jobs', jobs: [], storage: 'none' })
    }
  }

  if (req.method === 'PUT') {
    // Writing the shared job list is admin-only.
    if (!requireAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized — admin login required' })
    }
    try {
      const { jobs } = req.body || {}
      if (!Array.isArray(jobs)) {
        console.warn('[API] Invalid jobs payload')
        return res.status(400).json({ error: 'Invalid jobs payload' })
      }

      console.log('[API] Saving', jobs.length, 'jobs...')
      let savedToBlob = false
      let blobError = null

      if (hasToken) {
        try {
          await saveJobsToBlob(jobs)
          savedToBlob = true
          console.log('[API] Successfully saved to Blob')
        } catch (err) {
          blobError = err.message
          console.error('[API] Failed to save to Blob:', err.message)
        }
      }

      // Local file mirror — useful for local dev; ignored/ephemeral on Vercel.
      await saveJobsToFile(jobs)

      // On Vercel the file mirror does not persist, so a Blob failure is fatal there.
      if (hasToken && !savedToBlob) {
        return res.status(502).json({
          error: 'Could not persist jobs to Blob storage: ' + (blobError || 'unknown error'),
          savedToBlob: false,
          savedToFile: true,
        })
      }

      return res.status(200).json({
        success: true,
        savedToBlob,
        savedToFile: true,
        storage: savedToBlob ? 'blob' : 'file',
      })
    } catch (err) {
      console.error('[API] Jobs store PUT error:', err)
      return res.status(500).json({ error: err.message || 'Unable to save jobs' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
