import crypto from 'crypto'
import { get, put } from '@vercel/blob'

// Shared helpers for reading/writing JSON in the (private) Vercel Blob store.
const folder = (process.env.BLOB_FOLDER || 'uploads').replace(/^\/*|\/*$/g, '')

export function hashText(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex')
}

async function streamToString(stream) {
  if (stream && typeof stream.getReader === 'function') {
    const reader = stream.getReader()
    const chunks = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks).toString('utf-8')
  }
  const chunks = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf-8')
}

// Reads parsed jobs previously cached for this content hash, or null.
export async function readParseCache(key) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const result = await get(`${folder}/cache/${key}.json`, { access: 'private' })
    if (!result || !result.stream) return null
    const parsed = JSON.parse(await streamToString(result.stream))
    return Array.isArray(parsed) ? parsed : null
  } catch (err) {
    console.warn('[parse-cache] read miss/err:', err.message)
    return null
  }
}

// Stores parsed jobs for this content hash so identical PDFs skip the AI call.
export async function writeParseCache(key, jobs) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return
  try {
    await put(`${folder}/cache/${key}.json`, JSON.stringify(jobs), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 0,
    })
  } catch (err) {
    console.warn('[parse-cache] write failed:', err.message)
  }
}
