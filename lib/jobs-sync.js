export const JOBS_STORAGE_KEY = 'jobportal-jobs'

export function readStoredJobs() {
  if (typeof window === 'undefined') return null

  try {
    const saved = window.localStorage.getItem(JOBS_STORAGE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : null
  } catch (err) {
    console.warn('[JobsSync] Unable to read stored jobs:', err.message)
    return null
  }
}

export function writeStoredJobs(jobs) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs))
    window.dispatchEvent(new CustomEvent('jobportal-jobs-updated', { detail: { jobs } }))
  } catch (err) {
    console.warn('[JobsSync] Unable to persist jobs locally:', err.message)
  }
}
