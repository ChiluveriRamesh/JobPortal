import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { SEED_JOBS, INDIA_STATES } from '../lib/data'

const DEFAULT_MANUAL_FORM = {
  title: '',
  department: '',
  state: 'Central Government',
  education: 'Graduate',
  type: 'Group C',
  payScale: '',
  vacancies: '1',
  lastDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  ageLimit: '',
  selectionProcess: '',
  notifNo: '',
  description: '',
  applicationLink: ''
}

const STORAGE_KEY = 'jobportal-jobs'

const ADMIN_CREDENTIALS = {
  username: 'ramesh',
  password: 'ramesh4783!!'
}

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [manualForm, setManualForm] = useState(DEFAULT_MANUAL_FORM)
  const [jobs, setJobs] = useState(SEED_JOBS)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAuth = window.localStorage.getItem('jobportal-admin-auth')
      setIsLoggedIn(savedAuth === 'true')
      const savedJobs = window.localStorage.getItem(STORAGE_KEY)
      if (savedJobs) {
        try {
          setJobs(JSON.parse(savedJobs))
        } catch (err) {
          console.warn('Unable to parse saved jobs', err)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('jobportal-admin-auth', isLoggedIn ? 'true' : 'false')
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
    }
  }, [jobs])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  function handleLogin(e) {
    e.preventDefault()
    const normalizedPassword = form.password.trim().replace(/^ad\s+/i, '')
    if (form.username.trim().toLowerCase() === ADMIN_CREDENTIALS.username && normalizedPassword === ADMIN_CREDENTIALS.password) {
      setIsLoggedIn(true)
      setError('')
      setToast('Welcome back, admin.')
    } else {
      setError('Invalid admin credentials.')
      setToast('Invalid admin credentials.')
    }
  }

  function handleLogout() {
    setIsLoggedIn(false)
    setForm({ username: '', password: '' })
    setError('')
    setToast('You have been logged out.')
  }

  function arrayBufferToBase64(buffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
  }

  async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer()
    if (typeof window === 'undefined' || !window.pdfjsLib) {
      return ''
    }

    const pdfjsLib = window.pdfjsLib
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    let text = ''

    for (let i = 1; i <= Math.min(pdf.numPages, 8); i += 1) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((item) => item.str).join(' ') + '\n'
    }

    return text
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setToast('Please choose a PDF file.')
      return
    }

    setUploading(true)
    setProgress(10)
    setStatus('Reading PDF…')

    try {
      const fileData = await file.arrayBuffer()
      const base64 = arrayBufferToBase64(fileData)
      const uploadRes = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData: `data:${file.type || 'application/pdf'};base64,${base64}`, mimeType: file.type || 'application/pdf' })
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.pdfUrl) throw new Error(uploadData.error || 'Upload failed')

      setProgress(45)
      setStatus('Extracting job details with AI…')
      const text = await extractPdfText(file)

      const parseRes = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, filename: file.name })
      })

      if (!parseRes.ok) throw new Error('AI parsing failed')
      const parseData = await parseRes.json()
      const newItems = (parseData.jobs || []).map((job, index) => ({ ...job, id: Date.now() + index, fromPdf: true, pdfUrl: uploadData.pdfUrl }))
      setJobs(prev => [...newItems, ...prev])
      setProgress(100)
      setStatus(`Added ${newItems.length} job listing(s).`)
      setToast('PDF uploaded and processed successfully.')
    } catch (err) {
      setStatus(err.message || 'Upload failed')
      setToast(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      setTimeout(() => setStatus(''), 3000)
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    if (!manualForm.title.trim() || !manualForm.department.trim()) {
      setToast('Please enter a title and department.')
      return
    }

    const newJob = {
      id: Date.now(),
      fromPdf: false,
      title: manualForm.title.trim(),
      department: manualForm.department.trim(),
      state: manualForm.state || 'Central Government',
      education: manualForm.education || 'Graduate',
      type: manualForm.type || 'Group C',
      payScale: manualForm.payScale.trim() || 'As per notification',
      vacancies: Number(manualForm.vacancies) || 1,
      lastDate: manualForm.lastDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      icon: ['Banking','Teaching','Medical / Healthcare','Technical','Defence & Paramilitary','State Police','Finance / Accounts','Agriculture'].includes(manualForm.type) ? ({
        Banking: '🏦', Teaching: '📚', 'Medical / Healthcare': '🏥', Technical: '⚙️', 'Defence & Paramilitary': '🛡️', 'State Police': '👮', 'Finance / Accounts': '📊', Agriculture: '🌾'
      }[manualForm.type]) : '📌',
      notifNo: manualForm.notifNo.trim() || 'Manual Entry',
      ageLimit: manualForm.ageLimit.trim() || 'As per notification',
      selectionProcess: manualForm.selectionProcess.trim() || 'As per notification',
      description: manualForm.description.trim() || 'Added manually by the admin.',
      applicationLink: manualForm.applicationLink.trim() || ''
    }

    setJobs(prev => [newJob, ...prev])
    setManualForm(DEFAULT_MANUAL_FORM)
    setToast('Job added successfully.')
  }

  const stats = useMemo(() => ({
    total: jobs.length,
    vacancies: jobs.reduce((sum, job) => sum + (Number(job.vacancies) || 0), 0)
  }), [jobs])

  if (!isLoggedIn) {
    return (
      <>
        <Head>
        <title>Admin Login | Sarkari Naukri</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" />
      </Head>
        <div style={styles.page}>
          <div style={styles.card}>
            <div style={styles.brand}>🔐 Admin Access</div>
            <h1 style={styles.title}>Secure admin route</h1>
            <p style={styles.copy}>Only approved administrators can upload PDFs and manage notifications.</p>
            <form onSubmit={handleLogin} style={styles.form}>
              <label style={styles.label}>Username</label>
              <input style={styles.input} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
              <label style={styles.label}>Password</label>
              <input type="password" style={styles.input} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              {error ? <div style={styles.error}>{error}</div> : null}
              <button style={styles.primaryBtn} type="submit">Login</button>
            </form>
            <Link href="/" style={styles.link}>← Back to jobs</Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Admin Panel | Sarkari Naukri</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" />
      </Head>
      <div style={styles.page}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.brand}>🛠️ Admin Panel</div>
            <h1 style={styles.title}>Upload notifications and manage jobs</h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/" style={styles.secondaryBtn}>← Public Portal</Link>
            <button style={styles.secondaryBtn} onClick={handleLogout}>Logout</button>
          </div>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statBox}><strong>{stats.total}</strong><span>Total Jobs</span></div>
          <div style={styles.statBox}><strong>{stats.vacancies}</strong><span>Vacancies</span></div>
        </div>

        <div style={styles.grid}>
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Upload PDF Notification</h2>
            <p style={styles.copy}>Upload a PDF and let AI extract the jobs into the portal.</p>
            <label style={styles.uploadBox}>
              <input type="file" accept=".pdf" onChange={handleUpload} style={{ display: 'none' }} />
              <span style={{ fontSize: 32 }}>📄</span>
              <span>Click to upload PDF</span>
            </label>
            {uploading ? <div style={styles.progressBox}><div style={{ ...styles.progressBar, width: `${progress}%` }} /></div> : null}
            {status ? <p style={styles.status}>{status}</p> : null}
          </section>

          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>Add Job Manually</h2>
            <form onSubmit={handleManualSubmit} style={styles.form}>
              <input style={styles.input} value={manualForm.title} onChange={e => setManualForm({ ...manualForm, title: e.target.value })} placeholder="Job title" required />
              <input style={styles.input} value={manualForm.department} onChange={e => setManualForm({ ...manualForm, department: e.target.value })} placeholder="Department" required />
              <select style={styles.input} value={manualForm.state} onChange={e => setManualForm({ ...manualForm, state: e.target.value })}>
                {INDIA_STATES.map(state => <option key={state} value={state}>{state}</option>)}
              </select>
              <select style={styles.input} value={manualForm.education} onChange={e => setManualForm({ ...manualForm, education: e.target.value })}>
                <option value="Graduate">Graduate</option><option value="12th Pass">12th Pass</option><option value="10th Pass">10th Pass</option><option value="Post Graduate">Post Graduate</option>
              </select>
              <select style={styles.input} value={manualForm.type} onChange={e => setManualForm({ ...manualForm, type: e.target.value })}>
                {['Group A','Group B','Group C','Group D','Banking','Teaching','Medical / Healthcare','Technical','Defence & Paramilitary','State Police','Finance / Accounts','State PSC','Agriculture','Other'].map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <input style={styles.input} value={manualForm.vacancies} onChange={e => setManualForm({ ...manualForm, vacancies: e.target.value })} placeholder="Vacancies" />
              <input style={styles.input} value={manualForm.lastDate} onChange={e => setManualForm({ ...manualForm, lastDate: e.target.value })} type="date" />
              <input style={styles.input} value={manualForm.applicationLink} onChange={e => setManualForm({ ...manualForm, applicationLink: e.target.value })} placeholder="Application link" />
              <textarea style={{ ...styles.input, minHeight: 90 }} value={manualForm.description} onChange={e => setManualForm({ ...manualForm, description: e.target.value })} placeholder="Short description" />
              <button style={styles.primaryBtn} type="submit">Add Job</button>
            </form>
          </section>
        </div>
      </div>
      {toast ? <div style={styles.toast}>{toast}</div> : null}
    </>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f7fb', padding: 24, fontFamily: 'Inter, Arial, sans-serif' },
  card: { maxWidth: 460, margin: '60px auto', background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' },
  brand: { color: '#ff6a00', fontWeight: 700, marginBottom: 6 },
  title: { margin: 0, fontSize: 28, color: '#1a2744' },
  copy: { color: '#5a5a54', marginTop: 6 },
  form: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 },
  label: { fontWeight: 600, color: '#1a2744' },
  input: { border: '1px solid #d5dbe7', borderRadius: 10, padding: '10px 12px', fontSize: 14 },
  primaryBtn: { background: '#ff6a00', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 14px', cursor: 'pointer', fontWeight: 700 },
  secondaryBtn: { background: '#eef2f8', color: '#1a2744', border: 'none', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textDecoration: 'none' },
  link: { display: 'inline-block', marginTop: 14, color: '#1a2744', textDecoration: 'none' },
  error: { color: '#cc2200', fontSize: 13 },
  statsRow: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statBox: { background: '#fff', borderRadius: 14, padding: 16, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 },
  panel: { background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.05)' },
  panelTitle: { marginTop: 0, marginBottom: 6, color: '#1a2744' },
  uploadBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '2px dashed #ff6a00', borderRadius: 14, padding: 24, cursor: 'pointer', marginTop: 14, color: '#ff6a00' },
  progressBox: { height: 8, background: '#eef2f8', borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  progressBar: { height: '100%', background: '#138808', transition: 'width 0.3s' },
  status: { marginTop: 10, color: '#138808', fontWeight: 600 },
  toast: { position: 'fixed', bottom: 20, right: 20, background: '#1a2744', color: '#fff', padding: '12px 16px', borderRadius: 10 }
}
