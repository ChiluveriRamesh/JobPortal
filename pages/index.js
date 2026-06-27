import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import { SEED_JOBS, SAMPLE_TEXTS, INDIA_STATES } from '../lib/data'

const EDU_ORDER = [
  '8th Pass','10th Pass','12th Pass','ITI / Vocational',
  'Diploma / B.Tech','Graduate','B.Sc Nursing','B.Sc Agriculture',
  'Graduate (Commerce)','B.Ed / D.El.Ed','Post Graduate','PhD'
]

const EDUCATION_OPTIONS = [
  '8th Pass','10th Pass','12th Pass','ITI / Vocational',
  'Diploma / B.Tech','Graduate','B.Sc Nursing','B.Sc Agriculture',
  'Graduate (Commerce)','B.Ed / D.El.Ed','Post Graduate','PhD'
]

const TYPE_OPTIONS = [
  'Group A','Group B','Group C','Group D','Banking','Teaching',
  'Medical / Healthcare','Technical','Defence & Paramilitary','State Police',
  'Finance / Accounts','State PSC','Agriculture','Other'
]

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

const ADMIN_CREDENTIALS = {
  username: 'ramesh',
  password: 'ramesh4783!!'
}

function deadlineInfo(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr)
  const diff = Math.round((d - today) / 86400000)
  if (diff < 0) return { label: 'Closed', cls: 'closed' }
  if (diff === 0) return { label: 'Today!', cls: 'urgent' }
  if (diff <= 7) return { label: `${diff}d left`, cls: 'urgent' }
  if (diff <= 14) return { label: `${diff}d left`, cls: '' }
  return { label: d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }), cls: '' }
}

function countBy(jobs, key) {
  const m = {}
  jobs.forEach(j => { m[j[key]] = (m[j[key]] || 0) + 1 })
  return m
}

export default function Home() {
  const [jobs, setJobs] = useState(SEED_JOBS)
  const [filters, setFilters] = useState({ state: null, edu: null, type: null })
  const [sort, setSort] = useState('recent')
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [logs, setLogs] = useState([])
  const [toast, setToast] = useState(null)
  const [dragover, setDragover] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  const [manualForm, setManualForm] = useState(DEFAULT_MANUAL_FORM)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [adminForm, setAdminForm] = useState({ username: '', password: '' })
  const [adminError, setAdminError] = useState('')
  const [nextId, setNextId] = useState(200)
  const fileInputRef = useRef()
  const logEndRef = useRef()
  const toastTimer = useRef()

  // ── Filtered & sorted jobs ──
  const displayed = (() => {
    let list = jobs.filter(j => {
      if (filters.state && j.state !== filters.state) return false
      if (filters.edu && j.education !== filters.edu) return false
      if (filters.type && j.type !== filters.type) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = `${j.title} ${j.department} ${j.state} ${j.type} ${j.education}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (sort === 'deadline') list.sort((a,b) => new Date(a.lastDate) - new Date(b.lastDate))
    else if (sort === 'vacancies') list.sort((a,b) => b.vacancies - a.vacancies)
    else list.sort((a,b) => b.id - a.id)
    return list
  })()

  const statVacancies = displayed.reduce((s,j) => s + j.vacancies, 0)
  const statStates = new Set(displayed.map(j => j.state)).size
  const today = new Date()
  const statUrgent = displayed.filter(j => {
    const diff = (new Date(j.lastDate) - today) / 86400000
    return diff >= 0 && diff <= 14
  }).length

  const stateCounts = countBy(jobs, 'state')
  const eduCounts = countBy(jobs, 'education')
  const typeCounts = countBy(jobs, 'type')

  // scroll logs
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('jobportal-admin-auth')
    if (saved === 'true') setIsAdminAuthenticated(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jobportal-admin-auth', isAdminAuthenticated ? 'true' : 'false')
  }, [isAdminAuthenticated])

  function addLog(msg, cls = '') {
    setLogs(prev => [...prev, { msg, cls }])
  }

  function showToast(msg, type = 'info', dur = 3500) {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), dur)
  }

  function toggleFilter(key, val) {
    setFilters(prev => ({ ...prev, [key]: prev[key] === val ? null : val }))
  }

  // ── PDF extraction via pdf.js (client-side) ──
  async function extractText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          if (typeof window === 'undefined' || !window.pdfjsLib) {
            // Fallback: basic text decode
            resolve(new TextDecoder().decode(new Uint8Array(e.target.result)).substring(0, 7000))
            return
          }
          const pdfjsLib = window.pdfjsLib
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise
          let text = ''
          for (let i = 1; i <= Math.min(pdf.numPages, 12); i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            text += content.items.map(s => s.str).join(' ') + '\n'
          }
          resolve(text)
        } catch (err) { reject(err) }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  async function processText(text, filename, pdfUrl = '') {
    setProgress(50)
    setProgressLabel('Claude AI is reading the notification…')
    addLog('→ Sending to Claude AI (server-side, key is secure)…')

    const res = await fetch('/api/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, filename })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || `Server error ${res.status}`)
    }

    const data = await res.json()
    setProgress(90)
    addLog(`✓ Extracted ${data.count} job listing(s)`, 'ok')

    let idCounter = nextId
    const newJobs = data.jobs.map(j => ({ ...j, id: idCounter++, pdfUrl }))
    setNextId(idCounter)
    setJobs(prev => [...newJobs, ...prev])

    setProgress(100)
    setProgressLabel(`Done! Added ${data.count} job(s) to the portal.`)
    setTimeout(() => {
      setUploadOpen(false)
      resetUpload()
      showToast(`✓ Added ${data.count} job(s): ${newJobs.slice(0,2).map(j=>j.title).join(', ')}${newJobs.length > 2 ? '…' : ''}`, 'success', 5000)
    }, 1300)
  }

  async function handleFile(file) {
    if (!isAdminAuthenticated) {
      showToast('Admin login required to upload PDFs.', 'error')
      return
    }
    if (!file || (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf'))) {
      showToast('Please select a valid PDF file', 'error')
      return
    }
    setUploading(true)
    setProgress(10)
    setProgressLabel('Reading PDF file…')
    setLogs([])
    addLog(`✓ Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`, 'ok')
    try {
      const formData = new FormData()
      formData.append('pdf', file)
      const uploadRes = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.pdfUrl) {
        throw new Error(uploadData.error || 'Failed to store PDF')
      }

      const text = await extractText(file)
      addLog(`✓ Extracted ${text.length} characters of text`, 'ok')
      setProgress(35)
      await processText(text, file.name, uploadData.pdfUrl)
    } catch (err) {
      addLog(`✗ Error: ${err.message}`, 'error')
      showToast('Failed: ' + err.message, 'error')
      setUploading(false)
    }
  }

  async function loadSample(key) {
    if (!isAdminAuthenticated) {
      showToast('Admin login required to use sample uploads.', 'error')
      return
    }
    const text = SAMPLE_TEXTS[key]
    if (!text) return
    setUploading(true)
    setProgress(20)
    setProgressLabel('Loading sample notification…')
    setLogs([])
    addLog(`✓ Loaded sample: ${key.toUpperCase()}`, 'ok')
    try {
      await processText(text, `${key}-sample.pdf`)
    } catch (err) {
      addLog(`✗ Error: ${err.message}`, 'error')
      showToast('Failed: ' + err.message, 'error')
      setUploading(false)
    }
  }

  function handleAdminChange(e) {
    const { name, value } = e.target
    setAdminForm(prev => ({ ...prev, [name]: value }))
  }

  function handleAdminSubmit(e) {
    e.preventDefault()
    const normalizedPassword = adminForm.password.trim().replace(/^ad\s+/i, '')
    if (adminForm.username.trim().toLowerCase() === ADMIN_CREDENTIALS.username && normalizedPassword === ADMIN_CREDENTIALS.password) {
      setIsAdminAuthenticated(true)
      setAdminError('')
      setActiveTab('upload')
      showToast('Admin access granted', 'success', 2500)
    } else {
      setAdminError('Invalid admin credentials. Please try again.')
      showToast('Invalid admin credentials', 'error', 3000)
    }
  }

  function handleLogout() {
    setIsAdminAuthenticated(false)
    setAdminForm({ username: '', password: '' })
    setAdminError('')
    setActiveTab('upload')
    showToast('Admin logged out', 'info', 2200)
  }

  function openExternalLink(url) {
    if (!url) return
    const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`
    window.open(safeUrl, '_blank', 'noopener,noreferrer')
  }

  function handleManualChange(e) {
    const { name, value } = e.target
    setManualForm(prev => ({ ...prev, [name]: value }))
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    if (!isAdminAuthenticated) {
      showToast('Admin login required to add jobs manually.', 'error')
      return
    }
    if (!manualForm.title.trim() || !manualForm.department.trim()) {
      showToast('Please enter at least a job title and department.', 'error')
      return
    }

    const newJob = {
      id: nextId,
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
        Banking: '🏦',
        Teaching: '📚',
        'Medical / Healthcare': '🏥',
        Technical: '⚙️',
        'Defence & Paramilitary': '🛡️',
        'State Police': '👮',
        'Finance / Accounts': '📊',
        Agriculture: '🌾'
      }[manualForm.type]) : '📌',
      notifNo: manualForm.notifNo.trim() || 'Manual Entry',
      ageLimit: manualForm.ageLimit.trim() || 'As per notification',
      selectionProcess: manualForm.selectionProcess.trim() || 'As per notification',
      description: manualForm.description.trim() || `This job was added manually for ${manualForm.title.trim()}. Review the details and application process before applying.`,
      applicationLink: manualForm.applicationLink.trim() || ''
    }

    setNextId(prev => prev + 1)
    setJobs(prev => [newJob, ...prev])
    setUploadOpen(false)
    resetUpload()
    showToast(`Added job: ${newJob.title}`, 'success', 4000)
  }

  function resetUpload() {
    setUploading(false)
    setProgress(0)
    setProgressLabel('')
    setLogs([])
    setActiveTab('upload')
    setManualForm(DEFAULT_MANUAL_FORM)
    setAdminForm({ username: '', password: '' })
    setAdminError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <Head>
        <title>Sarkari Naukri — India Government Jobs Portal</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" />
      </Head>

      <style>{`
        /* ── Header ── */
        header { background: #1A2744; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
        .stripe { height: 4px; background: linear-gradient(90deg, #FF6A00 33.33%, white 33.33%, white 66.66%, #138808 66.66%); }
        .header-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 64px; gap: 20px; }
        .logo { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .logo-emblem { width: 40px; height: 40px; background: #FF6A00; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .logo-name { font-family: 'Noto Serif Display', serif; font-size: 18px; font-weight: 700; color: white; line-height: 1.1; }
        .logo-sub { font-size: 11px; color: rgba(255,255,255,0.55); letter-spacing: 0.05em; }
        .hsearch { flex: 1; max-width: 440px; position: relative; }
        .hsearch input { width: 100%; height: 38px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 0 14px 0 38px; color: white; font-size: 14px; outline: none; }
        .hsearch input::placeholder { color: rgba(255,255,255,0.4); }
        .hsearch input:focus { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.45); }
        .sicon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); font-size: 15px; pointer-events: none; }
        .btn-upload-h { display: flex; align-items: center; gap: 6px; background: #FF6A00; color: white; border: none; border-radius: 8px; padding: 0 18px; height: 38px; font-size: 13px; font-weight: 600; white-space: nowrap; transition: background 0.15s; }
        .btn-upload-h:hover { background: #e55f00; }
        .btn-ghost { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.12); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 0 12px; height: 38px; font-size: 13px; font-weight: 600; white-space: nowrap; }

        /* ── Layout ── */
        .page { max-width: 1200px; margin: 0 auto; padding: 24px 24px 60px; display: grid; grid-template-columns: 260px 1fr; gap: 24px; align-items: start; }
        @media(max-width:860px) { .page { grid-template-columns: 1fr; } .sidebar { position: static !important; } }
        @media(max-width:540px) { .hsearch { display: none; } .stats-bar { grid-template-columns: repeat(2,1fr) !important; } }

        /* ── Sidebar ── */
        .sidebar { position: sticky; top: 88px; display: flex; flex-direction: column; gap: 16px; }
        .fcard { background: white; border: 1px solid #E4E4E0; border-radius: 10px; overflow: hidden; }
        .fheader { padding: 11px 16px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #9A9A92; text-transform: uppercase; border-bottom: 1px solid #E4E4E0; background: #FAFAF8; }
        .flist { padding: 6px 0; max-height: 290px; overflow-y: auto; }
        .fitem { display: flex; align-items: center; justify-content: space-between; padding: 7px 16px; cursor: pointer; font-size: 13.5px; transition: background 0.1s; }
        .fitem:hover { background: #FAFAF8; }
        .fitem.active { background: #E8EDFB; color: #2D4070; font-weight: 500; }
        .fcount { font-size: 11px; background: #E4E4E0; color: #9A9A92; border-radius: 20px; padding: 1px 7px; min-width: 22px; text-align: center; }
        .fitem.active .fcount { background: #1A2744; color: white; }
        .clearbtn { width: 100%; padding: 9px 16px; background: none; border: none; border-top: 1px solid #E4E4E0; color: #FF6A00; font-size: 12.5px; font-weight: 500; transition: background 0.1s; }
        .clearbtn:hover { background: #FFF1E6; }

        /* ── Stats ── */
        .stats-bar { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        .scard { background: white; border: 1px solid #E4E4E0; border-radius: 10px; padding: 14px 16px; }
        .slabel { font-size: 11px; color: #9A9A92; font-weight: 500; letter-spacing: 0.04em; margin-bottom: 4px; }
        .sval { font-size: 22px; font-weight: 600; }
        .sval.navy { color: #1A2744; }
        .sval.saffron { color: #FF6A00; }
        .sval.green { color: #138808; }
        .sval.default { color: #1A1A18; }

        /* ── Toolbar ── */
        .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
        .tcount { font-size: 14px; color: #5A5A54; }
        .tcount strong { color: #1A1A18; }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #C8C8C2; border-radius: 20px; padding: 4px 13px; font-size: 12.5px; background: white; color: #5A5A54; transition: all 0.12s; }
        .chip:hover { border-color: #1A2744; color: #1A2744; }
        .chip.active { background: #1A2744; color: white; border-color: #1A2744; }

        /* ── Job cards ── */
        .jobs-list { display: flex; flex-direction: column; gap: 12px; }
        .jcard { background: white; border: 1px solid #E4E4E0; border-radius: 10px; padding: 18px 20px; transition: box-shadow 0.15s, border-color 0.15s; cursor: default; position: relative; }
        .jcard:hover { box-shadow: 0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04); border-color: #C8C8C2; }
        .jhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .jicon { width: 42px; height: 42px; border-radius: 8px; background: #E8EDFB; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .jtitle { font-size: 15px; font-weight: 600; line-height: 1.3; margin-bottom: 2px; }
        .jdept { font-size: 13px; color: #5A5A54; }
        .jdate { font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 20px; background: #FFF1E6; color: #FF6A00; white-space: nowrap; flex-shrink: 0; }
        .jdate.urgent { background: #FFECEC; color: #CC2200; }
        .jdate.closed { background: #FAFAF8; color: #9A9A92; }
        .jmeta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .tag { font-size: 12px; padding: 3px 9px; border-radius: 6px; font-weight: 500; }
        .tstate { background: #E8EDFB; color: #2D4070; }
        .tedu { background: #E6F5E6; color: #0a6006; }
        .ttype { background: #F3F0FF; color: #4A36A8; }
        .tpay { background: #FFF1E6; color: #994000; }
        .jdesc { font-size: 13px; color: #5A5A54; line-height: 1.6; margin: 0 0 12px; padding: 10px 12px; background: #FAFAF8; border: 1px solid #E4E4E0; border-radius: 8px; }
        .jfooter { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #E4E4E0; padding-top: 10px; gap: 8px; }
        .jvac { font-size: 13px; color: #5A5A54; }
        .jvac strong { color: #1A1A18; }
        .btn-apply { background: #1A2744; color: white; border: none; border-radius: 7px; padding: 6px 16px; font-size: 12.5px; font-weight: 500; transition: background 0.12s; }
        .btn-apply:hover { background: #2D4070; }
        .btn-secondary-compact { background: white; color: #1A2744; border: 1px solid #C8C8C2; border-radius: 7px; padding: 6px 12px; font-size: 12.5px; font-weight: 500; }
        .action-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .pdf-badge { position: absolute; top: 10px; right: 10px; background: #FF6A00; color: white; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.05em; }

        /* ── Empty ── */
        .empty { text-align: center; padding: 60px 24px; color: #9A9A92; }
        .empty-icon { font-size: 48px; margin-bottom: 12px; }
        .empty-title { font-size: 16px; font-weight: 600; color: #5A5A54; margin-bottom: 6px; }

        /* ── Upload overlay ── */
        .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.52); z-index: 200; align-items: center; justify-content: center; padding: 24px; }
        .overlay.open { display: flex; }
        .upanel { background: white; border-radius: 16px; width: 100%; max-width: 600px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .uphead { background: #1A2744; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; color: white; }
        .uphead h2 { font-size: 17px; font-weight: 600; }
        .uphead p { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 2px; }
        .closebtn { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 22px; line-height: 1; padding: 0; }
        .closebtn:hover { color: white; }
        .ubody { padding: 24px; }
        .dropzone { border: 2px dashed #C8C8C2; border-radius: 12px; padding: 40px 24px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .dropzone:hover, .dropzone.dragover { border-color: #FF6A00; background: #FFF1E6; }
        .drop-icon { font-size: 40px; margin-bottom: 12px; }
        .drop-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
        .drop-sub { font-size: 13px; color: #9A9A92; }
        .modal-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .tab-btn { border: 1px solid #C8C8C2; background: white; color: #5A5A54; border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 600; }
        .tab-btn.active { background: #1A2744; color: white; border-color: #1A2744; }
        .admin-box { background: #FAFAF8; border: 1px solid #E4E4E0; border-radius: 10px; padding: 16px; display: grid; gap: 10px; }
        .admin-box h3 { font-size: 15px; margin: 0; color: #1A2744; }
        .admin-box p { font-size: 13px; color: #5A5A54; margin: 0; }
        .admin-error { color: #CC2200; font-size: 12px; font-weight: 600; }
        .manual-form { display: grid; gap: 12px; }
        .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 12px; font-weight: 600; color: #5A5A54; }
        .field input, .field select, .field textarea { border: 1px solid #C8C8C2; border-radius: 8px; padding: 9px 10px; font-size: 13px; outline: none; }
        .field textarea { min-height: 90px; resize: vertical; }
        .field.full { grid-column: 1 / -1; }
        .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .btn-secondary { border: 1px solid #C8C8C2; background: white; color: #5A5A54; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; }
        .btn-primary { border: none; background: #FF6A00; color: white; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; }
        .prog-wrap { margin-top: 20px; }
        .prog-label { font-size: 13px; color: #5A5A54; margin-bottom: 8px; }
        .prog-bar { height: 6px; background: #E4E4E0; border-radius: 99px; overflow: hidden; margin-bottom: 12px; }
        .prog-fill { height: 100%; background: #FF6A00; border-radius: 99px; transition: width 0.3s; }
        .alog { background: #FAFAF8; border: 1px solid #E4E4E0; border-radius: 8px; padding: 12px 14px; font-size: 12px; font-family: monospace; max-height: 150px; overflow-y: auto; line-height: 1.8; }
        .log-ok { color: #138808; }
        .log-error { color: #CC2200; }
        .samples { margin-top: 16px; padding-top: 16px; border-top: 1px solid #E4E4E0; }
        .samples-label { font-size: 12px; color: #9A9A92; margin-bottom: 8px; font-weight: 500; }
        .sample-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .stag { background: #E8EDFB; color: #1A2744; border: none; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 500; transition: background 0.12s; }
        .stag:hover { background: #c8d5f7; }
        .stag:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Toast ── */
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 18px; border-radius: 10px; font-size: 13.5px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 300; max-width: 380px; transition: transform 0.25s, opacity 0.25s; transform: translateY(80px); opacity: 0; }
        .toast.show { transform: translateY(0); opacity: 1; }
        .toast-info { background: #1A2744; color: white; }
        .toast-success { background: #138808; color: white; }
        .toast-error { background: #CC2200; color: white; }
      `}</style>

      {/* Header */}
      <header>
        <div className="stripe" />
        <div className="header-inner">
          <div className="logo">
            <div className="logo-emblem">🏛️</div>
            <div>
              <div className="logo-name">Sarkari Naukri</div>
              <div className="logo-sub">GOVERNMENT JOBS PORTAL · INDIA</div>
            </div>
          </div>
          <div className="hsearch">
            <span className="sicon">🔍</span>
            <input
              type="text"
              placeholder="Search jobs, departments, states…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            {isAdminAuthenticated && (
              <button className="btn-ghost" onClick={handleLogout}>🔓 Logout</button>
            )}
            <button className="btn-upload-h" onClick={() => { setUploadOpen(true); if (!isAdminAuthenticated) { setAdminError(''); setAdminForm({ username: '', password: '' }) } }}>
              📄 Upload PDF Notification
            </button>
          </div>
        </div>
      </header>

      <div className="page">
        {/* Sidebar */}
        <aside className="sidebar">

          <div className="fcard">
            <div className="fheader">Filter by State</div>
            <div className="flist">
              {Object.entries(stateCounts).sort((a,b)=>b[1]-a[1]).map(([s,c]) => (
                <div key={s} className={`fitem${filters.state===s?' active':''}`} onClick={() => toggleFilter('state', s)}>
                  <span>{s}</span><span className="fcount">{c}</span>
                </div>
              ))}
            </div>
            <button className="clearbtn" onClick={() => setFilters(f=>({...f,state:null}))}>Clear state filter</button>
          </div>

          <div className="fcard">
            <div className="fheader">Education Level</div>
            <div className="flist">
              {Object.keys(countBy(jobs,'education')).sort((a,b)=>EDU_ORDER.indexOf(a)-EDU_ORDER.indexOf(b)).map(e => (
                <div key={e} className={`fitem${filters.edu===e?' active':''}`} onClick={() => toggleFilter('edu', e)}>
                  <span>{e}</span><span className="fcount">{countBy(jobs,'education')[e]}</span>
                </div>
              ))}
            </div>
            <button className="clearbtn" onClick={() => setFilters(f=>({...f,edu:null}))}>Clear education filter</button>
          </div>

          <div className="fcard">
            <div className="fheader">Job Type</div>
            <div className="flist">
              {Object.entries(countBy(jobs,'type')).sort((a,b)=>b[1]-a[1]).map(([t,c]) => (
                <div key={t} className={`fitem${filters.type===t?' active':''}`} onClick={() => toggleFilter('type', t)}>
                  <span>{t}</span><span className="fcount">{c}</span>
                </div>
              ))}
            </div>
            <button className="clearbtn" onClick={() => setFilters(f=>({...f,type:null}))}>Clear type filter</button>
          </div>

        </aside>

        {/* Main */}
        <main>

          {/* Stats */}
          <div className="stats-bar">
            <div className="scard"><div className="slabel">Total Jobs</div><div className="sval navy">{displayed.length}</div></div>
            <div className="scard"><div className="slabel">Vacancies</div><div className="sval saffron">{statVacancies.toLocaleString('en-IN')}</div></div>
            <div className="scard"><div className="slabel">States Covered</div><div className="sval green">{statStates}</div></div>
            <div className="scard"><div className="slabel">Closing Soon</div><div className="sval default">{statUrgent}</div></div>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="tcount">Showing <strong>{displayed.length}</strong> job{displayed.length !== 1 ? 's' : ''}</div>
            <div className="chips">
              {[['recent','📅 Most Recent'],['deadline','⏰ Closing Soon'],['vacancies','👥 Most Vacancies']].map(([key,label]) => (
                <button key={key} className={`chip${sort===key?' active':''}`} onClick={() => setSort(key)}>{label}</button>
              ))}
            </div>
          </div>

          {/* Jobs */}
          <div className="jobs-list">
            {displayed.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No jobs match your filters</div>
                <div>Try clearing a filter or uploading a new PDF notification</div>
              </div>
            ) : displayed.map(j => {
              const dl = deadlineInfo(j.lastDate)
              return (
                <div key={j.id} className="jcard">
                  {j.fromPdf && <span className="pdf-badge">FROM PDF</span>}
                  <div className="jhead">
                    <div className="jicon">{j.icon || '📌'}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div className="jtitle">{j.title}</div>
                      <div className="jdept">{j.department}</div>
                    </div>
                    <div className={`jdate${dl.cls?' '+dl.cls:''}`}>📅 {dl.label}</div>
                  </div>
                  <div className="jmeta">
                    <span className="tag tstate">📍 {j.state}</span>
                    <span className="tag tedu">🎓 {j.education}</span>
                    <span className="tag ttype">🏷️ {j.type}</span>
                    <span className="tag tpay">💰 {j.payScale}</span>
                  </div>
                  {j.description && <div className="jdesc">{j.description}</div>}
                  <div className="jfooter">
                    <div className="jvac">
                      Vacancies: <strong>{j.vacancies.toLocaleString('en-IN')}</strong>
                      {' · '}Age: {j.ageLimit}
                      {' · '}Ref: {j.notifNo}
                    </div>
                    <div className="action-row">
                      {(j.applicationLink || j.notifNo) && (
                        <button className="btn-secondary-compact" onClick={() => openExternalLink(j.applicationLink || j.notifNo)}>🌐 Open Site</button>
                      )}
                      {(j.pdfUrl || j.applicationLink) && (
                        <button className="btn-secondary-compact" onClick={() => openExternalLink(j.pdfUrl || j.applicationLink || '#')}>📄 Download PDF</button>
                      )}
                      <button className="btn-apply" onClick={() => openExternalLink(j.applicationLink || '#')}>Apply Now →</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        </main>
      </div>

      {/* Upload overlay */}
      <div className={`overlay${uploadOpen?' open':''}`} onClick={e => { if (e.target.className.includes('overlay')) { setUploadOpen(false); resetUpload() }}}>
        <div className="upanel">
          <div className="uphead">
            <div>
              <h2>Upload Job Notification PDF</h2>
              <p>AI extracts job details and adds them to the portal — API key stays on server</p>
            </div>
            <button className="closebtn" onClick={() => { setUploadOpen(false); resetUpload() }}>✕</button>
          </div>
          <div className="ubody">
            <div className="modal-tabs">
              <button type="button" className={`tab-btn${activeTab === 'upload' ? ' active' : ''}`} onClick={() => setActiveTab('upload')}>📄 Upload PDF</button>
              <button type="button" className={`tab-btn${activeTab === 'manual' ? ' active' : ''}`} onClick={() => setActiveTab('manual')}>✍️ Enter Job Details</button>
            </div>

            {!isAdminAuthenticated ? (
              <form className="admin-box" onSubmit={handleAdminSubmit}>
                <h3>Admin access required</h3>
                <p>Use the credentials below to unlock PDF upload and manual job entry.</p>
                <div className="form-grid">
                  <div className="field full">
                    <label>Username</label>
                    <input name="username" value={adminForm.username} onChange={handleAdminChange} placeholder="ramesh" required />
                  </div>
                  <div className="field full">
                    <label>Password</label>
                    <input name="password" type="password" value={adminForm.password} onChange={handleAdminChange} placeholder="ramesh4783!!" required />
                  </div>
                </div>
                {adminError && <div className="admin-error">{adminError}</div>}
                <div className="form-actions">
                  <button type="submit" className="btn-primary">Unlock Admin Panel</button>
                </div>
              </form>
            ) : activeTab === 'upload' ? (
              <>
                <div
                  className={`dropzone${dragover?' dragover':''}`}
                  onDragOver={e => { e.preventDefault(); setDragover(true) }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={e => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]) }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="drop-icon">📑</div>
                  <div className="drop-title">Drop PDF here or click to browse</div>
                  <div className="drop-sub">Government job notifications, employment news, recruitment ads</div>
                  <input ref={fileInputRef} type="file" accept=".pdf" style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
                </div>

                {uploading && (
                  <div className="prog-wrap">
                    <div className="prog-label">{progressLabel}</div>
                    <div className="prog-bar"><div className="prog-fill" style={{width: progress+'%'}} /></div>
                    {logs.length > 0 && (
                      <div className="alog">
                        {logs.map((l,i) => (
                          <div key={i} className={l.cls==='ok'?'log-ok':l.cls==='error'?'log-error':''}>{l.msg}</div>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    )}
                  </div>
                )}

                <div className="samples">
                  <div className="samples-label">Or try a sample notification:</div>
                  <div className="sample-list">
                    {[['upsc','UPSC Civil Services 2025'],['rrb','RRB NTPC Group D'],['ssc','SSC CGL Multi-Post'],['state_police','State Police Recruitment'],['banking','IBPS PO / Clerk 2025']].map(([key,label]) => (
                      <button key={key} className="stag" disabled={uploading} onClick={() => loadSample(key)}>{label}</button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <form className="manual-form" onSubmit={handleManualSubmit}>
                <div className="form-grid">
                  <div className="field full">
                    <label>Job Title</label>
                    <input name="title" value={manualForm.title} onChange={handleManualChange} placeholder="e.g. Junior Engineer" required />
                  </div>
                  <div className="field full">
                    <label>Department / Organization</label>
                    <input name="department" value={manualForm.department} onChange={handleManualChange} placeholder="e.g. Public Works Department" required />
                  </div>
                  <div className="field">
                    <label>State</label>
                    <select name="state" value={manualForm.state} onChange={handleManualChange}>
                      {INDIA_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Education</label>
                    <select name="education" value={manualForm.education} onChange={handleManualChange}>
                      {EDUCATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Job Type</label>
                    <select name="type" value={manualForm.type} onChange={handleManualChange}>
                      {TYPE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Vacancies</label>
                    <input name="vacancies" type="number" min="1" value={manualForm.vacancies} onChange={handleManualChange} />
                  </div>
                  <div className="field">
                    <label>Pay Scale</label>
                    <input name="payScale" value={manualForm.payScale} onChange={handleManualChange} placeholder="₹35,000 – ₹1,10,000" />
                  </div>
                  <div className="field">
                    <label>Last Date</label>
                    <input name="lastDate" type="date" value={manualForm.lastDate} onChange={handleManualChange} />
                  </div>
                  <div className="field">
                    <label>Age Limit</label>
                    <input name="ageLimit" value={manualForm.ageLimit} onChange={handleManualChange} placeholder="18–35 years" />
                  </div>
                  <div className="field full">
                    <label>Selection Process</label>
                    <input name="selectionProcess" value={manualForm.selectionProcess} onChange={handleManualChange} placeholder="Written Exam → Interview" />
                  </div>
                  <div className="field">
                    <label>Notification No.</label>
                    <input name="notifNo" value={manualForm.notifNo} onChange={handleManualChange} placeholder="e.g. SSC/2025/123" />
                  </div>
                  <div className="field">
                    <label>Application Link</label>
                    <input name="applicationLink" value={manualForm.applicationLink} onChange={handleManualChange} placeholder="https://example.com/apply" />
                  </div>
                  <div className="field full">
                    <label>Description</label>
                    <textarea name="description" value={manualForm.description} onChange={handleManualChange} placeholder="Short summary shown on the card" />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setActiveTab('upload'); setManualForm(DEFAULT_MANUAL_FORM) }}>Cancel</button>
                  <button type="submit" className="btn-primary">Add Job</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast show toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  )
}
