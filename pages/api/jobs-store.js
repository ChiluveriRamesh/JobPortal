import { list, put } from '@vercel/blob'
import { promises as fs } from 'fs'
import { join } from 'path'

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

async function findJobsBlob() {
  const result = await list({ prefix: jobsPath, limit: 1 })
  if (!result?.blobs?.length) return null
  return result.blobs[0]
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
    return JSON.parse(content)
  } catch (err) {
    console.warn('Could not load local jobs file:', err.message)
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

  console.log('[API] Jobs store', req.method, '| Blob token:', !!process.env.BLOB_READ_WRITE_TOKEN ? 'YES' : 'NO')

  if (req.method === 'GET') {
    try {
      // Try Vercel Blob first if token is configured
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          console.log('[API] Looking for blob at:', jobsPath)
          const blob = await findJobsBlob()
          if (blob) {
            console.log('[API] Found blob, fetching from:', blob.url.substring(0, 60) + '...')
            const fetchRes = await fetch(blob.url)
            if (fetchRes.ok) {
              const jobs = await fetchRes.json()
              console.log('[API] Loaded', jobs.length, 'jobs from Blob')
              return res.status(200).json({ jobs, storage: 'blob', found: true })
            }
          } else {
            console.log('[API] No blob found yet')
          }
        } catch (err) {
          console.warn('[API] Blob fetch failed, falling back to local file:', err.message)
        }
      }

      // Fall back to local file-based storage
      const jobs = await loadJobsFromFile()
      console.log('[API] Loaded', jobs.length, 'jobs from local file')
      return res.status(200).json({ jobs, storage: 'file', found: jobs.length > 0 })
    } catch (err) {
      console.error('[API] Jobs store GET error:', err)
      return res.status(500).json({ error: err.message || 'Unable to load jobs', jobs: [], storage: 'none' })
    }
  }

  if (req.method === 'PUT') {
    try {
      const { jobs } = req.body || {}
      if (!Array.isArray(jobs)) {
        console.warn('[API] Invalid jobs payload')
        return res.status(400).json({ error: 'Invalid jobs payload' })
      }

      console.log('[API] Saving', jobs.length, 'jobs...')
      let savedToBlob = false
      let savedToFile = false

      // Try to save to Vercel Blob if token is configured
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          console.log('[API] Attempting to save to Blob at:', jobsPath)
          await put(jobsPath, JSON.stringify(jobs), {
            access: 'public',
            contentType: 'application/json',
          })
          savedToBlob = true
          console.log('[API] Successfully saved to Blob')
        } catch (err) {
          console.error('[API] Failed to save to Blob:', err.message)
        }
      }

      // Always save to local file as fallback
      await saveJobsToFile(jobs)
      savedToFile = true
      console.log('[API] Saved to local file')

      return res.status(200).json({
        success: true,
        savedToBlob,
        savedToFile,
        storage: savedToBlob ? 'blob' : 'file',
      })
    } catch (err) {
      console.error('[API] Jobs store PUT error:', err)
      return res.status(500).json({ error: err.message || 'Unable to save jobs' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
