import { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { SEED_JOBS } from '../lib/data'

const EDU_ORDER = [
  '8th Pass','10th Pass','12th Pass','ITI / Vocational',
  'Diploma / B.Tech','Graduate','B.Sc Nursing','B.Sc Agriculture',
  'Graduate (Commerce)','B.Ed / D.El.Ed','Post Graduate','PhD'
]

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

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    try {
      const res = await fetch('/api/jobs-store')
      if (!res.ok) throw new Error('Unable to load jobs')
      const data = await res.json()
      if (Array.isArray(data.jobs) && data.jobs.length > 0) {
        setJobs(data.jobs)
      }
    } catch (err) {
      console.error('[Portal] Job store load failed:', err.message)
    }
  }

  function toggleFilter(key, val) {
    setFilters(prev => ({ ...prev, [key]: prev[key] === val ? null : val }))
  }

  function openActionLink(url, filename = 'document.pdf') {
    if (!url) return
    if (url.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      return
    }
    const safeUrl = /^https?:\/\//i.test(url) || url.startsWith('/') ? url : `https://${url}`
    window.open(safeUrl, '_blank', 'noopener,noreferrer')
  }

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

  const statVacancies = displayed.reduce((s,j) => s + (Number(j.vacancies) || 0), 0)
  const statStates = new Set(displayed.map(j => j.state)).size
  const today = new Date()
  const statUrgent = displayed.filter(j => {
    const diff = (new Date(j.lastDate) - today) / 86400000
    return diff >= 0 && diff <= 14
  }).length

  const stateCounts = countBy(jobs, 'state')

  return (
    <>
      <Head>
        <title>Sarkari Naukri — India Government Jobs Portal</title>
      </Head>

      <style>{`
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

        .dashboard-banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-radius: 14px; margin-bottom: 18px; border: 1px solid #DCECD8; background: linear-gradient(135deg, #F7FBF7 0%, #FFFFFF 100%); }
        .dashboard-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #9A9A92; margin-bottom: 4px; }
        .dashboard-title { font-size: 20px; font-weight: 700; color: #1A2744; }
        .dashboard-sub { font-size: 13px; color: #5A5A54; margin-top: 4px; max-width: 640px; }
        .dashboard-note { font-size: 13px; color: #5A5A54; }

        .page { max-width: 1200px; margin: 0 auto; padding: 24px 24px 60px; display: grid; grid-template-columns: 260px 1fr; gap: 24px; align-items: start; }
        @media(max-width:860px) { .page { grid-template-columns: 1fr; } .sidebar { position: static !important; } }
        @media(max-width:540px) { .hsearch { display: none; } .stats-bar { grid-template-columns: repeat(2,1fr) !important; } }

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

        .stats-bar { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        .scard { background: white; border: 1px solid #E4E4E0; border-radius: 10px; padding: 14px 16px; }
        .slabel { font-size: 11px; color: #9A9A92; font-weight: 500; letter-spacing: 0.04em; margin-bottom: 4px; }
        .sval { font-size: 22px; font-weight: 600; }
        .sval.navy { color: #1A2744; }
        .sval.saffron { color: #FF6A00; }
        .sval.green { color: #138808; }
        .sval.default { color: #1A1A18; }

        .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
        .tcount { font-size: 14px; color: #5A5A54; }
        .tcount strong { color: #1A1A18; }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #C8C8C2; border-radius: 20px; padding: 4px 13px; font-size: 12.5px; background: white; color: #5A5A54; transition: all 0.12s; }
        .chip:hover { border-color: #1A2744; color: #1A2744; }
        .chip.active { background: #1A2744; color: white; border-color: #1A2744; }

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

        .empty { text-align: center; padding: 60px 24px; color: #9A9A92; }
        .empty-icon { font-size: 48px; margin-bottom: 12px; }
        .empty-title { font-size: 16px; font-weight: 600; color: #5A5A54; margin-bottom: 6px; }
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
          <Link href="/admin" className="btn-upload-h" style={{textDecoration:'none', display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
            🔐 Admin Panel
          </Link>
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
          <div className="dashboard-banner">
            <div>
              <div className="dashboard-eyebrow">Public portal</div>
              <div className="dashboard-title">Job Seeker Dashboard</div>
              <div className="dashboard-sub">Browse government jobs, compare deadlines, and apply directly from the latest openings.</div>
            </div>
            <div className="dashboard-note">Use filters to discover the right opportunity quickly.</div>
          </div>

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
                <div>Try clearing a filter to see more openings</div>
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
                      Vacancies: <strong>{(Number(j.vacancies) || 0).toLocaleString('en-IN')}</strong>
                      {' · '}Age: {j.ageLimit}
                      {' · '}Ref: {j.notifNo}
                    </div>
                    <div className="action-row">
                      {(j.applicationLink || j.notifNo) && (
                        <button className="btn-secondary-compact" onClick={() => openActionLink(j.applicationLink || j.notifNo, `${j.title || 'job'}.pdf`)}>🌐 Open Site</button>
                      )}
                      {(j.pdfUrl || j.applicationLink) && (
                        <button className="btn-secondary-compact" onClick={() => openActionLink(j.pdfUrl || j.applicationLink || '#', `${j.title || 'job'}-notification.pdf`)}>📄 Download PDF</button>
                      )}
                      <button className="btn-apply" onClick={() => openActionLink(j.applicationLink || '#', `${j.title || 'job'}-application.pdf`)}>Apply Now →</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      </div>
    </>
  )
}
