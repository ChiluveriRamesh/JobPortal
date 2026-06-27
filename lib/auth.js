import crypto from 'crypto'

// Server-side admin auth. Credentials and signing secret come from environment
// variables, with sensible fallbacks so the app still works out of the box.
// On Vercel, set ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SESSION_SECRET to lock it down.
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'ramesh').toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ramesh4783!!'
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

// If no explicit session secret is set, derive a stable one from the password so
// tokens can't be forged without knowing it.
function secret() {
  return process.env.ADMIN_SESSION_SECRET || `sarkari-naukri::${ADMIN_PASSWORD}`
}

function sign(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('hex')
}

function safeEqual(a, b) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function verifyCredentials(username, password) {
  const u = (username || '').trim().toLowerCase()
  // The login forms historically tolerated a stray "ad " prefix on the password.
  const p = (password || '').trim().replace(/^ad\s+/i, '')
  return u === ADMIN_USERNAME && safeEqual(p, ADMIN_PASSWORD)
}

export function issueToken(username) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL_MS })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  if (!safeEqual(sig, sign(payload))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    if (!data.exp || Date.now() > data.exp) return null
    return data
  } catch {
    return null
  }
}

// Returns the decoded session if the request carries a valid bearer token, else null.
export function requireAuth(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return verifyToken(token)
}
