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

  if (req.method === 'GET') {
    try {
      // Try Vercel Blob first if token is configured
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const blob = await findJobsBlob()
          if (blob) {
            const fetchRes = await fetch(blob.url)
            if (fetchRes.ok) {
              const jobs = await fetchRes.json()
              return res.status(200).json({ jobs, storage: 'blob', found: true })
            }
          }
        } catch (err) {
          console.warn('Blob fetch failed, falling back to local file:', err.message)
        }
      }

      // Fall back to local file-based storage
      const jobs = await loadJobsFromFile()
      return res.status(200).json({ jobs, storage: 'file', found: jobs.length > 0 })
    } catch (err) {
      console.error('Jobs store GET error:', err)
      return res.status(500).json({ error: err.message || 'Unable to load jobs', jobs: [], storage: 'none' })
    }
  }

  if (req.method === 'PUT') {
    try {
      const { jobs } = req.body || {}
      if (!Array.isArray(jobs)) {
        return res.status(400).json({ error: 'Invalid jobs payload' })
      }

      let savedToBlob = false
      let savedToFile = false

      // Try to save to Vercel Blob if token is configured
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          await put(jobsPath, JSON.stringify(jobs), {
            access: 'public',
            contentType: 'application/json',
          })
          savedToBlob = true
        } catch (err) {
          console.warn('Failed to save to Blob:', err.message)
        }
      }

      // Always save to local file as fallback
      await saveJobsToFile(jobs)
      savedToFile = true

      return res.status(200).json({
        success: true,
        savedToBlob,
        savedToFile,
        storage: savedToBlob ? 'blob' : 'file',
      })
    } catch (err) {
      console.error('Jobs store PUT error:', err)
      return res.status(500).json({ error: err.message || 'Unable to save jobs' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
