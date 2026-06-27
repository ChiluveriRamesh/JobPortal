import { list, put } from '@vercel/blob'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const folder = (process.env.BLOB_FOLDER || 'uploads').replace(/^\/+|\/+$/g, '')
const jobsPath = `${folder}/jobs.json`

async function findJobsBlob() {
  const result = await list({ prefix: jobsPath, limit: 1 })
  if (!result?.blobs?.length) return null
  return result.blobs[0]
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(200).json({ jobs: [], found: false })
      }

      const blob = await findJobsBlob()
      if (!blob) {
        return res.status(200).json({ jobs: [], found: false })
      }

      const fetchRes = await fetch(blob.url)
      if (!fetchRes.ok) {
        throw new Error(`Job store fetch failed: ${fetchRes.status}`)
      }

      const jobs = await fetchRes.json()
      return res.status(200).json({ jobs, found: true })
    } catch (err) {
      console.error('Jobs store GET error:', err)
      return res.status(500).json({ error: err.message || 'Unable to load jobs', jobs: [], found: false })
    }
  }

  if (req.method === 'PUT') {
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({ error: 'Blob storage is not configured' })
      }

      const { jobs } = req.body || {}
      if (!Array.isArray(jobs)) {
        return res.status(400).json({ error: 'Invalid jobs payload' })
      }

      const uploadResult = await put(jobsPath, JSON.stringify(jobs), {
        access: 'public',
        contentType: 'application/json',
      })

      return res.status(200).json({ success: true, url: uploadResult.url })
    } catch (err) {
      console.error('Jobs store PUT error:', err)
      return res.status(500).json({ error: err.message || 'Unable to save jobs' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
