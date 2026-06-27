import { verifyCredentials, issueToken } from '../../lib/auth'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username, password } = req.body || {}

  if (!verifyCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid admin credentials' })
  }

  const token = issueToken((username || '').trim().toLowerCase())
  return res.status(200).json({ token, expiresInHours: 12 })
}
