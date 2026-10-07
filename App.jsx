import { useState, useEffect, useRef } from 'react'
const T = { 5: 85, 4: 75, 3: 65, 2: 55 }
const gr = p => (p >= 85 ? 5 : p >= 75 ? 4 : p >= 65 ? 3 : p >= 55 ? 2 : 0)
const f1 = x => x.toFixed(1)
const KEY = 'gradeTracker.v3', GRADES = [5, 6, 7, 8, 9, 10, 11]
const uid = () => Math.random().toString(36).slice(2, 10)
// default weekly lessons (= credits). Everything is editable per subject.
const CR = { 'Math': 8, 'Science': 5, 'Physics': 4, 'Chemistry': 4, 'Biology': 4, 'Computer Science (CS)': 4, 'English': 4, 'Ona tili': 2, 'Adabiyot': 2, 'History': 2, 'Huquq (Hq)': 1, 'Global Perspectives (GP)': 1, 'Tarbiya': 1, 'Kelajak': 1, 'CHQBT': 2 }
const NO_GPA = ['Tarbiya', 'Kelajak', 'CHQBT']
const template = g => {
  const sci = g <= 7 ? ['Science'] : ['Physics', 'Chemistry', 'Biology']   // grades 5-7: one combined Science subject
  const list = ['Math', ...sci, 'Computer Science (CS)', 'English', 'Ona tili', 'Adabiyot', 'History', ...(g >= 10 ? ['Huquq (Hq)'] : []), 'Global Perspectives (GP)', 'Tarbiya', 'Kelajak', ...(g >= 10 ? ['CHQBT'] : [])]  // CHQBT only grades 10-11
  return list.map(n => ({ id: uid(), name: n, credits: CR[n] ?? 1, gpa: !NO_GPA.includes(n), eos: null, summ: [] }))
}
const fresh = (name, grade) => ({ v: 3, name, cur: { grade, term: 1 }, sems: Object.fromEntries(GRADES.flatMap(g => [1, 2].map(t => [g + '-' + t, template(g)]))) })
const SKEY = 'gradeTracker.session'
const call = body => fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => {
  const j = await r.json().catch(() => ({ error: 'Server error' }))
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { status: r.status, body: j })
  return j
})
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.sems ? s : null } catch { return null } }

// Summatives = 60 points (avg% x 0.6). EOS = 40 points (eos% x 0.4). No guessing: EOS counts only once you enter it.
function calc(s, tg) {
  const t = T[tg], ok = s.summ.filter(x => x.score != null), done = ok.length
  const tot = ok.reduce((a, x) => a + (x.score / (x.mx || 100)) * 100, 0)
  const avg = done ? tot / done : null, sp = avg == null ? 0 : avg * 0.6, ep = s.eos != null ? s.eos * 0.4 : null
  const r = { done, avg, sp, ep, t, tg, final: null, grade: null, best: null, bestGrade: null, need: null, head: '', sub: '' }
  if (avg == null) { r.head = 'Add your first summative'; return r }
  r.best = sp + 40; r.bestGrade = gr(r.best)
  if (ep != null) {
    r.final = sp + ep; r.grade = gr(r.final)
    r.head = r.final >= t ? `You hit grade ${tg}` : `${f1(t - r.final)} points short of ${tg}`
    r.sub = `Final ${f1(r.final)}% = ${f1(sp)} + ${f1(ep)}.`
  } else {
    const n = (t - sp) / 0.4; r.need = n
    if (n <= 0) { r.head = `Grade ${tg} is locked in`; r.sub = 'Any EOS score keeps you there.' }
    else if (n > 100) { r.head = 'Out of reach'; r.sub = `Even 100% on the EOS gives ${f1(r.best)}%, below ${t}%.` }
    else { r.head = `EOS: at least ${f1(n)}%`; r.sub = `${f1(t - sp)} of 40 points lands you exactly on ${t}%.` }
  }
  return r
}
// University style GPA: sum(grade points x credits) / sum(credits). Credits = weekly lessons.
const gpa = rows => { const w = rows.reduce((a, x) => a + (x.cr || 0), 0); return w ? rows.reduce((a, x) => a + x.g * (x.cr || 0), 0) / w : null }
const semGpa = (subs, tg, best) => gpa(subs.filter(s => s.gpa !== false).map(s => { const c = calc(s, tg); return { cr: s.credits, g: c.grade ?? (best ? c.bestGrade : null) } }).filter(x => x.g != null))
const g2 = x => (x == null ? '–' : x.toFixed(2))

function useCount(v) {
  const [n, set] = useState(0)
  useEffect(() => { let id; const a = n, t0 = performance.now()
    const step = t => { const k = Math.min(1, (t - t0) / 700); set(a + (v - a) * (1 - (1 - k) ** 3)); if (k < 1) id = requestAnimationFrame(step) }
    id = requestAnimationFrame(step); return () => cancelAnimationFrame(id) }, [v])
  return n
}
// text input that lets you clear everything (no forced 0)
function Num({ value, onCommit, ...p }) {
  const [t, setT] = useState(value ?? '')
  useEffect(() => { if (!(t === '' && value == null) && parseFloat(t) !== value) setT(value ?? '') }, [value])
  return <input type="text" inputMode="decimal" value={t} {...p} onChange={e => {
    const v = e.target.value.replace(',', '.'); if (!/^\d*\.?\d*$/.test(v)) return
    setT(v); onCommit(v === '' || v === '.' ? null : +v) }} />
}

function SubjectView({ s, c, tg, up, upSum, addSum, delSum, delSub }) {
  const n = useCount(c.final ?? c.sp), sp = c.sp, ep = c.ep, tot = sp + (ep ?? 0)
  const gap = ep == null && c.avg != null ? Math.min(40, Math.max(0, c.t - sp)) : 0
  const note = c.avg == null ? 'Add summatives to see your placeholder.' : ep != null ? `Summatives ${f1(sp)}/60 + EOS ${f1(ep)}/40 = ${f1(tot)}.`
    : c.t - sp <= 0 ? `Summatives alone already reach ${c.t}. The EOS is a bonus.`
    : c.t - sp > 40 ? `Grade ${tg} is out of reach: summatives are ${f1(sp)}/60 and a perfect EOS gives ${f1(sp + 40)}.`
    : `Placeholder: you need at least ${f1(gap / 0.4)}% on the EOS (${f1(gap)} of 40 points) to land on ${c.t}.`
  return (<div className="view" key={s.id}>
    <div className="card hero">
      <div><h2>{s.name}</h2><p className="mu">{c.done} summative{c.done == 1 ? '' : 's'} in, EOS {s.eos != null ? s.eos + '%' : 'not taken yet'}</p></div>
      <div className="big gc" data-g={c.grade ?? undefined}>{c.final != null ? <>{c.grade}<small>{f1(n)}%</small></> : c.avg != null ? <>{f1(n)}<small>/ 60 so far</small></> : '–'}</div>
    </div>
    <div className="card"><h3>Summatives, out of 60</h3>
      <div className="meter"><div className="fill" style={{ clipPath: `inset(0 ${100 - (c.avg ?? 0)}% 0 0)` }} />
        <span className="tick" style={{ left: '0%' }}>0</span><span className="tick" style={{ left: '100%' }}>60</span>
        {c.avg != null && <span className="pin" style={{ left: c.avg + '%' }}>{f1(sp)} / 60</span>}</div>
      <p className="mu">{c.avg == null ? 'No summatives yet.' : `Average ${f1(c.avg)}% x 60% = ${f1(sp)} points.`}</p></div>
    <div className="card"><h3>Final grade, out of 100</h3>
      <div className="meter">
        <div className="seg solid" style={{ width: sp + '%' }} />
        {ep != null && <div className="seg eos" style={{ left: sp + '%', width: ep + '%' }} />}
        {gap > 0 && <div className="seg ghost" style={{ left: sp + '%', width: gap + '%' }} />}
        <span className="split" style={{ left: '60%' }} />
        {[55, 65, 75, 85].map(v => <span key={v} className={'tick' + (v == T[tg] ? ' t' : '')} style={{ left: v + '%' }}>{v}</span>)}
        {c.avg != null && <span className="pin" style={{ left: tot + '%' }}>{f1(tot)}{ep == null ? ' so far' : ''}</span>}
      </div><p className="mu">{note}</p></div>
    <div className="two">
      <div className="card"><h3>Lowest EOS for grade {tg}</h3><div className="head">{c.head}</div><p className="mu">{c.sub}</p></div>
      <div className="card"><div className="stats">
        <div><small>Summative avg</small><b>{c.avg == null ? '–' : f1(c.avg) + '%'}</b></div>
        <div><small>If EOS = 100%</small><b className="gc" data-g={c.bestGrade ?? undefined}>{c.best == null ? '–' : `${f1(c.best)}% → ${c.bestGrade}`}</b></div></div></div>
    </div>
    <div className="card"><h3>Subject settings</h3><div className="f">
      <label>Credits (lessons per week)<Num value={s.credits} onCommit={v => up(s.id, { credits: v })} /></label>
      <label className="chk"><span>Counts toward GPA</span><input type="checkbox" checked={s.gpa !== false} onChange={e => up(s.id, { gpa: e.target.checked })} /></label>
      <label>Actual EOS %<Num value={s.eos} placeholder="not taken yet" onCommit={v => up(s.id, { eos: v == null ? null : Math.min(100, v) })} /></label>
    </div></div>
    <div className="card"><div className="row"><h3>Summatives</h3><button className="btn pri" onClick={() => addSum(s)}>Add summative</button></div>
      {!s.summ.length && <p className="mu">No scores yet. Add one to light this up.</p>}
      {!!s.summ.length && <table><thead><tr><th>Name</th><th>Score</th><th>Out of</th><th>%</th><th /></tr></thead><tbody>
        {s.summ.map(x => <tr key={x.id}>
          <td><input value={x.name ?? ''} onChange={v => upSum(s.id, x.id, { name: v.target.value })} /></td>
          <td className="n"><Num value={x.score} onCommit={v => upSum(s.id, x.id, { score: v })} /></td>
          <td className="n"><Num value={x.mx} placeholder="100" onCommit={v => upSum(s.id, x.id, { mx: v })} /></td>
          <td>{x.score != null ? f1((x.score / (x.mx || 100)) * 100) : '–'}</td>
          <td><button className="x" aria-label="Delete" onClick={() => delSum(s.id, x.id)}>×</button></td></tr>)}
      </tbody></table>}
    </div>
    <button className="btn danger" onClick={() => delSub(s)}>Delete subject</button>
  </div>)
}

function Report({ S, subs, tg, title }) {
  const L = subs.map(s => ({ s, c: calc(s, tg) })).sort((a, b) => (b.c.avg ?? -1) - (a.c.avg ?? -1))
  const all = gpa(Object.values(S.sems).flat().filter(s => s.gpa !== false).map(s => ({ cr: s.credits, g: calc(s, tg).grade })).filter(x => x.g != null))
  const csv = () => {
    const q = v => `"${String(v).replace(/"/g, '""')}"`
    const rows = [['Subject', 'Credits', 'In GPA', 'Summ pts /60', 'EOS', 'Final', 'Grade', 'Lowest EOS for target'], ...L.map(({ s, c }) => [s.name, s.credits, s.gpa !== false ? 'yes' : 'no', f1(c.sp), s.eos ?? '', c.final == null ? '' : f1(c.final), c.grade ?? '', c.need == null ? '' : f1(c.need)])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' })); a.download = `${title}.csv`; a.click()
  }
  const sg = semGpa(subs, tg, false)
  return (<div className="view"><div className="card hero"><div><h2>Report</h2><p className="mu">{title}, ranked by summative average</p></div>
    <div className="big gc" data-g={sg == null ? undefined : Math.round(sg)}>{g2(sg)}<small>GPA</small></div></div>
    <div className="card"><div className="stats">
      <div><small>Semester GPA (EOS taken)</small><b>{g2(sg)}</b></div>
      <div><small>Best case, EOS 100% on the rest</small><b>{g2(semGpa(subs, tg, true))}</b></div>
      <div><small>Cumulative GPA, all semesters</small><b>{g2(all)}</b></div></div>
      <p className="mu" style={{ marginTop: 10, fontSize: 13 }}>GPA = sum of (grade x credits) / sum of credits, 5-point scale. Credits are lessons per week. Subjects marked "no" are left out.</p></div>
    <div className="card"><table className="rep"><thead><tr><th>#</th><th>Subject</th><th>Cr</th><th>GPA</th><th>Summ /60</th><th>EOS</th><th>Final</th><th>Grade</th><th>Lowest EOS needed</th></tr></thead><tbody>
      {L.map(({ s, c }, i) => <tr key={s.id} style={{ animationDelay: i * 40 + 'ms' }}><td>{i + 1}</td><td>{s.name}</td><td>{s.credits}</td><td className="mu">{s.gpa !== false ? 'yes' : 'no'}</td><td>{c.avg == null ? '–' : f1(c.sp)}</td><td>{s.eos ?? '–'}</td>
        <td>{c.final == null ? '–' : f1(c.final)}</td><td><span className="gb gc" data-g={c.grade ?? undefined}>{c.grade ?? '–'}</span></td>
        <td className="mu">{c.need == null ? (c.final != null ? 'done' : '–') : c.need <= 0 ? 'any' : c.need > 100 ? 'out of reach' : f1(c.need) + '%'}</td></tr>)}
    </tbody></table></div><button className="btn pri" onClick={csv}>Export CSV</button></div>)
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState('in'), [name, setName] = useState(''), [pw, setPw] = useState(''), [grade, setGrade] = useState(10)
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const go = async () => {
    if (!name.trim() || !pw) return setErr('Enter your name and password.')
    setErr(''); setBusy(true)
    try { const r = await call({ action: mode == 'in' ? 'login' : 'register', name, password: pw }); onAuth({ token: r.token, name: r.name }, r.doc, grade) }
    catch (e) { setErr(e.message) }
    setBusy(false)
  }
  return (<div className="welcome"><div className="card hero" style={{ display: 'block', maxWidth: 440, width: '100%' }}>
    <h2>{mode == 'in' ? 'Sign in' : 'Create account'}</h2>
    <p className="mu" style={{ margin: '6px 0 18px' }}>{mode == 'in' ? 'Welcome back. Your scores follow you to any device.' : 'Pick a name and a password. Use them on any device to get your scores back.'}</p>
    <div className="f" style={{ flexDirection: 'column' }}>
      <label>Your name<input autoFocus value={name} style={{ width: '100%' }} onChange={e => setName(e.target.value)} /></label>
      <label>Password<input type="password" value={pw} style={{ width: '100%' }} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key == 'Enter' && go()} /></label>
      {mode == 'up' && <label>Your current grade<select value={grade} onChange={e => setGrade(+e.target.value)}>{GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}</select></label>}
      {err && <p className="err">{err}</p>}
      <button className="btn pri" disabled={busy} onClick={go}>{busy ? 'Please wait…' : mode == 'in' ? 'Sign in' : 'Create account'}</button>
      <button className="link" onClick={() => { setMode(mode == 'in' ? 'up' : 'in'); setErr('') }}>{mode == 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
      <button className="link" onClick={() => name.trim() ? onAuth(null, null, grade, name.trim()) : setErr('Type a name first.')}>Use on this device only (no account)</button>
    </div></div></div>)
}

export default function App() {
  const [sess, setSess] = useState(() => { try { return JSON.parse(localStorage.getItem(SKEY)) } catch { return null } })
  const [S, setS] = useState(load), [G, setG] = useState(S?.cur.grade ?? 10), [Tm, setTm] = useState(S?.cur.term ?? 1)
  const [i, setI] = useState(0), [view, setView] = useState('s'), [tg, setTg] = useState(+localStorage.tg || 5)
  const [booting, setBooting] = useState(!!sess?.token), [sync, setSync] = useState('')
  const rev = useRef(0), skip = useRef(false)
  const adopt = doc => { skip.current = true; rev.current = doc.rev; setS(doc.state); setG(doc.state.cur.grade); setTm(doc.state.cur.term); setI(0) }
  const logout = () => { if (sess?.token) call({ action: 'logout', token: sess.token }).catch(() => {}); localStorage.removeItem(SKEY); localStorage.removeItem(KEY); setSess(null); setS(null); setView('s') }
  const onAuth = (ses, doc, grade, localName) => {
    if (ses) {
      localStorage.setItem(SKEY, JSON.stringify(ses)); setSess(ses)
      if (doc) adopt(doc); else { rev.current = 0; setS(fresh(ses.name, grade)); setG(grade); setTm(1); setI(0) }
    } else { const l = { local: true }; localStorage.setItem(SKEY, JSON.stringify(l)); setSess(l); setS(fresh(localName, grade)); setG(grade); setTm(1); setI(0) }
  }
  // load the account's data from the server on open
  useEffect(() => {
    if (!sess?.token) return
    call({ action: 'load', token: sess.token }).then(r => { if (r.doc) adopt(r.doc); setSync('Saved') })
      .catch(e => { if (e.status === 401) logout(); else setSync("Offline, showing this device's copy") })
      .finally(() => setBooting(false))
  }, [])
  // save locally right away, to the server a moment after the last change
  useEffect(() => {
    if (!S || booting) return
    localStorage.setItem(KEY, JSON.stringify(S))
    if (!sess?.token) return
    if (skip.current) { skip.current = false; return }
    setSync('Saving…')
    const t = setTimeout(async () => {
      try { const r = await call({ action: 'save', token: sess.token, rev: rev.current, state: S }); rev.current = r.rev; setSync('Saved') }
      catch (e) {
        if (e.status === 409 && e.body.doc) { adopt(e.body.doc); setSync('Updated from your other device') }
        else if (e.status === 401) logout()
        else setSync('Offline, will retry on your next change')
      }
    }, 900)
    return () => clearTimeout(t)
  }, [S, booting])
  // when you come back to the tab, pick up changes made on another device
  useEffect(() => {
    if (!sess?.token) return
    const f = async () => { if (document.visibilityState != 'visible') return
      try { const r = await call({ action: 'load', token: sess.token }); if (r.doc && r.doc.rev > rev.current) { adopt(r.doc); setSync('Updated from your other device') } } catch {} }
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f)
  }, [sess])
  useEffect(() => { localStorage.tg = tg }, [tg])
  useEffect(() => { document.title = S ? `${S.name}'s grades` : 'Grade Tracker' }, [S?.name])
  if (!sess || (!S && !booting)) return <Auth onAuth={onAuth} />
  if (booting || !S) return <p className="mu" style={{ padding: 30 }}>Loading…</p>

  const key = G + '-' + Tm, subs = S.sems[key], s = subs[i], title = `Grade ${G}, semester ${Tm}`, cur = S.cur
  const setSubs = fn => setS(p => ({ ...p, sems: { ...p.sems, [key]: fn(p.sems[key]) } }))
  const up = (id, d) => setSubs(a => a.map(x => x.id == id ? { ...x, ...d } : x))
  const upSum = (sub, id, d) => setSubs(a => a.map(x => x.id == sub ? { ...x, summ: x.summ.map(y => y.id == id ? { ...y, ...d } : y) } : x))
  const addSum = x => setSubs(a => a.map(y => y.id == x.id ? { ...y, summ: [...y.summ, { id: uid(), name: 'Summative ' + (y.summ.length + 1), score: null, mx: 100 }] } : y))
  const delSum = (sub, id) => setSubs(a => a.map(x => x.id == sub ? { ...x, summ: x.summ.filter(y => y.id != id) } : x))
  const addSub = () => { const name = prompt('Subject name')?.trim(); if (!name) return; setSubs(a => [...a, { id: uid(), name, credits: 1, gpa: true, eos: null, summ: [] }]); setI(subs.length); setView('s') }
  const delSub = x => { if (confirm(`Delete ${x.name}?`)) { setSubs(a => a.filter(y => y.id != x.id)); setI(0) } }
  const pickGrade = g => { setG(g); setTm(1); setI(0) }   // changing grade always goes back to semester 1
  const pickTerm = t => { setTm(t); setI(0) }
  const makeCur = () => setS(p => ({ ...p, cur: { grade: G, term: Tm } }))
  const isCur = G == cur.grade && Tm == cur.term
  const backup = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = `${S.name}-grades.json`; a.click() }
  const restore = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const d = JSON.parse(t); if (!d.sems) throw 0; setS(d); setG(d.cur.grade); setTm(d.cur.term); setI(0) } catch { alert('That is not a valid backup file.') } }); e.target.value = '' }

  return (<div className="app">
    <aside><h1 title={S.name}>{S.name}<span>{title}</span></h1>
      <nav>{subs.map((x, k) => { const c = calc(x, tg); return <button key={x.id} className={'sub' + (k == i && view == 's' ? ' on' : '')} onClick={() => { setI(k); setView('s') }}>
        <span>{x.name}</span>{c.grade != null ? <b className="gc" data-g={c.grade}>{c.grade}</b> : c.avg != null && <b className="dim">{Math.round(c.avg)}%</b>}</button> })}</nav>
      <button className="btn" onClick={addSub}>Add subject</button>
      <p className="sync">{sess.token ? sync : 'Saved on this device only'}</p>
      <div className="mini"><button onClick={backup}>Backup</button><label>Restore<input type="file" accept=".json" hidden onChange={restore} /></label><button onClick={logout}>Log out</button></div></aside>
    <main>
      <div className="sel">
        <div className="seg2">{GRADES.map(g => <button key={g} className={g == G ? 'on' : ''} onClick={() => pickGrade(g)}>Grade {g}{g == cur.grade && <em>current</em>}</button>)}</div>
        <div className="seg2">{[1, 2].map(t => <button key={t} className={t == Tm ? 'on' : ''} onClick={() => pickTerm(t)}>Semester {t}{isCur && t == Tm && <em>current</em>}</button>)}</div>
        {!isCur && <button className="btn pri" onClick={makeCur}>Set as current</button>}
      </div>
      <div className="top">
        <div className="tabs"><button className={view == 's' ? 'on' : ''} onClick={() => setView('s')}>Subject</button><button className={view == 'r' ? 'on' : ''} onClick={() => setView('r')}>Report</button></div>
        <div className="opts"><label>Target grade <select value={tg} onChange={e => setTg(+e.target.value)}>{[5, 4, 3, 2].map(g => <option key={g}>{g}</option>)}</select></label></div></div>
      {view == 'r' ? <Report S={S} subs={subs} tg={tg} title={title} /> : s ? <SubjectView s={s} c={calc(s, tg)} tg={tg} up={up} upSum={upSum} addSum={addSum} delSum={delSum} delSub={delSub} /> : <p className="mu">No subjects here. Add one on the left.</p>}
    </main></div>)
}
