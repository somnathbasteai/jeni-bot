'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile, Income, EMI, Subscription, Project, Task, Goal, HealthLog } from '@/lib/types'

// ═══════════════════════════════════════════════════
// JENI DASHBOARD — Production App
// Real data. Real AI. Real everything.
// ═══════════════════════════════════════════════════

const TABS = [
  { id: 'chat', label: 'Jeni AI', icon: '✦' },
  { id: 'overview', label: 'Overview', icon: '⌘' },
  { id: 'data', label: 'My Data', icon: '◈' },
  { id: 'settings', label: 'Setup', icon: '⚙' },
]

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [loading, setLoading] = useState(true)

  // All data states
  const [profile, setProfile] = useState<Profile | null>(null)
  const [income, setIncome] = useState<Income | null>(null)
  const [emis, setEmis] = useState<EMI[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [todayHealth, setTodayHealth] = useState<HealthLog | null>(null)

  // ── Auth Check ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUser(user)
      loadAllData(user.id)
    })
  }, [router])

  // ── Load ALL data from Supabase ──
  async function loadAllData(userId: string) {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [profileR, incomeR, emisR, subsR, projR, tasksR, goalsR, healthR] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      supabase.from('income').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
      supabase.from('emis').select('*').eq('user_id', userId).eq('status', 'active'),
      supabase.from('subscriptions').select('*').eq('user_id', userId).eq('status', 'active'),
      supabase.from('projects').select('*').eq('user_id', userId),
      supabase.from('tasks').select('*').eq('user_id', userId).eq('is_done', false).order('due_date'),
      supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'in_progress'),
      supabase.from('health_logs').select('*').eq('user_id', userId).eq('date', today).single(),
    ])

    setProfile(profileR.data)
    setIncome(incomeR.data?.[0] || null)
    setEmis(emisR.data || [])
    setSubs(subsR.data || [])
    setProjects(projR.data || [])
    setTasks(tasksR.data || [])
    setGoals(goalsR.data || [])
    setTodayHealth(healthR.data)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 animate-pulse mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-mono">Loading your life data...</p>
        </div>
      </div>
    )
  }

  const netSalary = income
    ? income.base_salary + income.overtime + income.bonus - income.deductions_pf - income.deductions_tax - income.deductions_other
    : 0
  const totalEMI = emis.reduce((s, e) => s + e.emi_amount, 0)
  const totalSubs = subs.reduce((s, sub) => s + sub.amount, 0)

  return (
    <div className="min-h-screen flex bg-[#09090b] text-gray-200">
      {/* Sidebar */}
      <div className="w-[72px] flex-shrink-0 bg-white/[0.015] border-r border-white/[0.04] flex flex-col items-center py-5 gap-1">
        <div className="w-11 h-11 rounded-[14px] bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-black font-display mb-5 shadow-lg shadow-purple-500/20">
          J
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all relative ${
              activeTab === tab.id ? 'bg-purple-500/15 text-purple-400' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {tab.icon}
            {activeTab === tab.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-purple-500" />
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={handleLogout} className="w-9 h-9 rounded-lg bg-white/[0.03] text-gray-600 text-sm hover:text-red-400 transition-colors">
          ⏻
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto max-h-screen p-8">
        {activeTab === 'chat' && <ChatView user={user} profile={profile} />}
        {activeTab === 'overview' && (
          <OverviewView
            profile={profile} income={income} netSalary={netSalary}
            emis={emis} totalEMI={totalEMI} subs={subs} totalSubs={totalSubs}
            projects={projects} tasks={tasks} goals={goals} todayHealth={todayHealth}
          />
        )}
        {activeTab === 'data' && user && (
          <DataView user={user} onRefresh={() => loadAllData(user.id)} />
        )}
        {activeTab === 'settings' && <SetupGuide />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// CHAT VIEW — Talk to Jeni with real AI
// ═══════════════════════════════════════════════════

function ChatView({ user, profile }: { user: any; profile: Profile | null }) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    {
      role: 'jeni',
      text: `Hey ${profile?.name || 'there'}! 👋 I'm Jeni — your life intelligence.\n\nI'm connected to your real data in Supabase. Ask me anything:\n\n• "How's my money?" — Full financial analysis\n• "EMI situation" — Debt overview & strategy\n• "What should I focus on?" — Priority recommendations\n• "Project status" — All your projects\n• "Good morning" — Daily briefing\n\nIf you haven't added data yet, go to the "My Data" tab first to set up your info. The more data I have, the smarter I get! 🧠`
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim()) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: text.trim() }])
    setIsTyping(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ message: text.trim(), sessionId }),
      })

      const data = await res.json()
      if (data.sessionId) setSessionId(data.sessionId)
      setMessages(prev => [...prev, { role: 'jeni', text: data.reply || data.error || 'Something went wrong' }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'jeni', text: '❌ Could not reach Jeni. Check your internet and API keys.' }])
    }
    setIsTyping(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="pb-4 mb-2 border-b border-white/[0.04] flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-lg">✦</div>
        <div>
          <div className="text-white font-bold font-display">Jeni AI</div>
          <div className="text-gray-600 text-xs font-mono">Connected to Supabase + Groq · Full life context</div>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto flex flex-col gap-4 py-3">
        {messages.map((m, i) => (
          <div key={i} className={`${m.role === 'user' ? 'self-end' : 'self-start'} max-w-[80%]`}>
            <div className={`px-5 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 rounded-tr-sm'
                : 'bg-white/[0.04] border border-white/[0.06] rounded-tl-sm font-mono'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="self-start bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-5 py-3 text-sm text-gray-500 font-mono">
            ✦ Jeni is thinking...
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 py-2 flex-wrap">
        {['💰 Money', '📋 EMIs', '🚀 Projects', '🎯 Goals', '📅 Schedule', '😴 Health'].map(q => (
          <button key={q} onClick={() => sendMessage(q.split(' ').slice(1).join(' '))}
            className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-gray-500 text-xs font-mono hover:text-purple-400 hover:border-purple-500/20 transition-all">
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-3 pt-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder="Ask Jeni anything about your life..."
          className="flex-1 py-3.5 px-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white text-sm outline-none focus:border-purple-500/40 transition-colors"
        />
        <button onClick={() => sendMessage(input)}
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white text-lg flex items-center justify-center hover:opacity-90 transition-opacity">
          ✦
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// OVERVIEW — Shows all real data at a glance
// ═══════════════════════════════════════════════════

function OverviewView({ profile, income, netSalary, emis, totalEMI, subs, totalSubs, projects, tasks, goals, todayHealth }: any) {
  const name = profile?.name || 'there'

  if (!income && emis.length === 0 && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="text-6xl mb-6">🏗️</div>
        <h2 className="text-2xl font-bold text-white font-display mb-3">No data yet, {name}!</h2>
        <p className="text-gray-500 max-w-md mb-6">
          Jeni needs your data to be intelligent. Go to the "My Data" tab and add your salary, EMIs, subscriptions, and projects.
          The more you add, the smarter Jeni gets!
        </p>
        <div className="text-gray-600 text-sm font-mono">Click ◈ My Data in the sidebar to start →</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold text-white font-display">Hey, {name}!</h1>
        <p className="text-gray-500 mt-1 text-sm">Here's your real-time life snapshot from Supabase.</p>
      </div>

      {/* Finance Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'NET SALARY', val: fmt(netSalary), color: 'text-green-400', sub: income?.month || '-' },
          { label: 'TOTAL EMI', val: fmt(totalEMI), color: 'text-red-400', sub: `${emis.length} active` },
          { label: 'SUBSCRIPTIONS', val: fmt(totalSubs), color: 'text-yellow-400', sub: `${subs.length} active` },
          { label: 'FREE CASH', val: fmt(netSalary - totalEMI - totalSubs), color: 'text-purple-400', sub: 'After fixed costs' },
        ].map((c, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[10px] text-gray-600 font-mono tracking-widest mb-2">{c.label}</div>
            <div className={`text-2xl font-extrabold font-display ${c.color}`}>{c.val}</div>
            <div className="text-xs text-gray-600 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* EMIs */}
      {emis.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
          <h3 className="text-xs text-gray-600 font-mono tracking-widest mb-4">ACTIVE EMIs</h3>
          <div className="flex flex-col gap-3">
            {emis.map((e: EMI) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                <div>
                  <div className="text-white font-semibold text-sm">{e.name}</div>
                  <div className="text-gray-600 text-xs">{e.lender || 'Unknown'} · Due {e.due_day}th · {e.remaining_months} months left</div>
                </div>
                <div className="text-yellow-400 font-bold font-mono">{fmt(e.emi_amount)}/mo</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
          <h3 className="text-xs text-gray-600 font-mono tracking-widest mb-4">PROJECTS</h3>
          <div className="grid grid-cols-2 gap-3">
            {projects.map((p: Project) => (
              <div key={p.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-semibold">{p.name}</div>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                    p.priority === 'critical' ? 'bg-red-500/10 text-red-400' :
                    p.priority === 'high' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>{p.priority}</span>
                </div>
                <div className="text-xs text-gray-500 mb-3">{p.description || 'No description'}</div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-1000"
                    style={{ width: `${p.progress}%` }} />
                </div>
                <div className="text-xs text-gray-600 mt-1 font-mono">{p.progress}% complete</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
          <h3 className="text-xs text-gray-600 font-mono tracking-widest mb-4">PENDING TASKS ({tasks.length})</h3>
          <div className="flex flex-col gap-2">
            {tasks.slice(0, 8).map((t: Task) => (
              <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.01] border border-white/[0.03]">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-sm text-gray-300 flex-1">{t.title}</span>
                {t.due_date && <span className="text-xs text-gray-600 font-mono">{t.due_date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// DATA VIEW — Add/Edit your real data
// ═══════════════════════════════════════════════════

function DataView({ user, onRefresh }: { user: any; onRefresh: () => void }) {
  if (!user) return null
  const [section, setSection] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const sections = [
    { id: 'profile', label: '👤 Profile' },
    { id: 'salary', label: '💰 Salary' },
    { id: 'emi', label: '📋 Add EMI' },
    { id: 'subscription', label: '🔄 Add Subscription' },
    { id: 'project', label: '🚀 Add Project' },
    { id: 'task', label: '✅ Add Task' },
    { id: 'health', label: '🏥 Today\'s Health' },
  ]

  async function saveData(table: string, data: any) {
    setSaving(true)
    setMsg('')
    const { error } = await supabase.from(table).insert({ ...data, user_id: user.id })
    setSaving(false)
    if (error) {
      setMsg(`❌ Error: ${error.message}`)
    } else {
      setMsg('✅ Saved successfully!')
      onRefresh()
    }
  }

  async function upsertProfile(data: Partial<Profile>) {
    setSaving(true)
    setMsg('')
    if (!user) return
    
    // Check if profile exists
    const { data: existing } = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
    let error: any
    if (existing) {
      const { error: updateError } = await supabase.from('profiles').eq('user_id', user.id).update(data as any)
      error = updateError
    } else {
      const { error: insertError } = await supabase.from('profiles').insert(({ ...data, user_id: user.id } as any))
      error = insertError
    }
    setSaving(false)
    if (error) setMsg(`❌ Error: ${error.message}`)
    else { setMsg('✅ Profile saved!'); onRefresh() }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white font-display mb-1">My Data</h2>
      <p className="text-gray-500 text-sm mb-6">Add your real data here. Jeni uses ALL of this to give smart, personalized answers.</p>

      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {sections.map(s => (
          <button key={s.id} onClick={() => { setSection(s.id); setMsg('') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              section === s.id ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' : 'bg-white/[0.03] text-gray-500 border border-white/[0.04] hover:text-gray-300'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {msg && <div className={`mb-4 p-3 rounded-xl text-sm ${msg.includes('❌') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{msg}</div>}

      {/* Forms */}
      {section === 'profile' && <ProfileForm onSave={upsertProfile} saving={saving} />}
      {section === 'salary' && <SalaryForm onSave={(d: any) => saveData('income', d)} saving={saving} />}
      {section === 'emi' && <EMIForm onSave={(d: any) => saveData('emis', d)} saving={saving} />}
      {section === 'subscription' && <SubForm onSave={(d: any) => saveData('subscriptions', d)} saving={saving} />}
      {section === 'project' && <ProjectForm onSave={(d: any) => saveData('projects', d)} saving={saving} />}
      {section === 'task' && <TaskForm onSave={(d: any) => saveData('tasks', d)} saving={saving} />}
      {section === 'health' && <HealthForm onSave={(d: any) => saveData('health_logs', d)} saving={saving} />}
    </div>
  )
}

// ── Form Components ──

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-gray-500 font-mono mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputClass = "w-full py-2.5 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm outline-none focus:border-purple-500/40 transition-colors"
const btnClass = "w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"

function ProfileForm({ onSave, saving }: any) {
  const [f, setF] = useState({ name: '', location: '', phone: '', blood_group: '', birthday: '', wake_time: '06:30', sleep_time: '23:30' })
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="space-y-0">
      <FormField label="FULL NAME *"><input value={f.name} onChange={e => setF({...f, name: e.target.value})} className={inputClass} required /></FormField>
      <FormField label="LOCATION"><input value={f.location} onChange={e => setF({...f, location: e.target.value})} placeholder="e.g. Nashik, Maharashtra" className={inputClass} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="WAKE TIME"><input type="time" value={f.wake_time} onChange={e => setF({...f, wake_time: e.target.value})} className={inputClass} /></FormField>
        <FormField label="SLEEP TIME"><input type="time" value={f.sleep_time} onChange={e => setF({...f, sleep_time: e.target.value})} className={inputClass} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="BLOOD GROUP"><input value={f.blood_group} onChange={e => setF({...f, blood_group: e.target.value})} placeholder="e.g. B+" className={inputClass} /></FormField>
        <FormField label="BIRTHDAY"><input type="date" value={f.birthday} onChange={e => setF({...f, birthday: e.target.value})} className={inputClass} /></FormField>
      </div>
      <button type="submit" disabled={saving} className={btnClass}>{saving ? 'Saving...' : 'Save Profile'}</button>
    </form>
  )
}

function SalaryForm({ onSave, saving }: any) {
  const [f, setF] = useState({ month: 'February', year: 2026, base_salary: 0, overtime: 0, bonus: 0, freelance: 0, deductions_pf: 0, deductions_tax: 0, deductions_other: 0 })
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="space-y-0">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="MONTH"><input value={f.month} onChange={e => setF({...f, month: e.target.value})} className={inputClass} /></FormField>
        <FormField label="YEAR"><input type="number" value={f.year} onChange={e => setF({...f, year: +e.target.value})} className={inputClass} /></FormField>
      </div>
      <FormField label="BASE SALARY (₹)"><input type="number" value={f.base_salary || ''} onChange={e => setF({...f, base_salary: +e.target.value})} className={inputClass} required /></FormField>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="OVERTIME (₹)"><input type="number" value={f.overtime || ''} onChange={e => setF({...f, overtime: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="BONUS (₹)"><input type="number" value={f.bonus || ''} onChange={e => setF({...f, bonus: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="FREELANCE (₹)"><input type="number" value={f.freelance || ''} onChange={e => setF({...f, freelance: +e.target.value})} className={inputClass} /></FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="PF DEDUCTION"><input type="number" value={f.deductions_pf || ''} onChange={e => setF({...f, deductions_pf: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="TAX DEDUCTION"><input type="number" value={f.deductions_tax || ''} onChange={e => setF({...f, deductions_tax: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="OTHER DEDUCTION"><input type="number" value={f.deductions_other || ''} onChange={e => setF({...f, deductions_other: +e.target.value})} className={inputClass} /></FormField>
      </div>
      <button type="submit" disabled={saving} className={btnClass}>{saving ? 'Saving...' : 'Save Salary'}</button>
    </form>
  )
}

function EMIForm({ onSave, saving }: any) {
  const [f, setF] = useState({ name: '', lender: '', emi_amount: 0, due_day: 1, interest_rate: 0, total_months: 0, remaining_months: 0, status: 'active' })
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="space-y-0">
      <FormField label="EMI NAME *"><input value={f.name} onChange={e => setF({...f, name: e.target.value})} placeholder="e.g. Bike Loan, Phone EMI" className={inputClass} required /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="LENDER / BANK"><input value={f.lender} onChange={e => setF({...f, lender: e.target.value})} placeholder="e.g. HDFC, SBI" className={inputClass} /></FormField>
        <FormField label="EMI AMOUNT (₹) *"><input type="number" value={f.emi_amount || ''} onChange={e => setF({...f, emi_amount: +e.target.value})} className={inputClass} required /></FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="DUE DAY (1-31)"><input type="number" min="1" max="31" value={f.due_day} onChange={e => setF({...f, due_day: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="TOTAL MONTHS"><input type="number" value={f.total_months || ''} onChange={e => setF({...f, total_months: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="REMAINING"><input type="number" value={f.remaining_months || ''} onChange={e => setF({...f, remaining_months: +e.target.value})} className={inputClass} /></FormField>
      </div>
      <FormField label="INTEREST RATE (%)"><input type="number" step="0.1" value={f.interest_rate || ''} onChange={e => setF({...f, interest_rate: +e.target.value})} className={inputClass} /></FormField>
      <button type="submit" disabled={saving} className={btnClass}>{saving ? 'Saving...' : 'Add EMI'}</button>
    </form>
  )
}

function SubForm({ onSave, saving }: any) {
  const [f, setF] = useState({ name: '', amount: 0, category: 'tools', billing_cycle: 'monthly', is_essential: false, status: 'active' })
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="space-y-0">
      <FormField label="NAME *"><input value={f.name} onChange={e => setF({...f, name: e.target.value})} placeholder="e.g. Netflix, AWS" className={inputClass} required /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="AMOUNT (₹)"><input type="number" value={f.amount || ''} onChange={e => setF({...f, amount: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="CATEGORY">
          <select value={f.category} onChange={e => setF({...f, category: e.target.value})} className={inputClass}>
            <option value="entertainment">Entertainment</option>
            <option value="tools">Tools</option>
            <option value="business">Business</option>
            <option value="health">Health</option>
            <option value="education">Education</option>
          </select>
        </FormField>
      </div>
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={f.is_essential} onChange={e => setF({...f, is_essential: e.target.checked})} className="rounded" />
        <span className="text-sm text-gray-400">This is essential (can't be cut)</span>
      </label>
      <button type="submit" disabled={saving} className={btnClass}>{saving ? 'Saving...' : 'Add Subscription'}</button>
    </form>
  )
}

function ProjectForm({ onSave, saving }: any) {
  const [f, setF] = useState({ name: '', description: '', status: 'active', progress: 0, priority: 'high', tech_stack: '', target_launch: '' })
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="space-y-0">
      <FormField label="PROJECT NAME *"><input value={f.name} onChange={e => setF({...f, name: e.target.value})} placeholder="e.g. DigiKaragir" className={inputClass} required /></FormField>
      <FormField label="DESCRIPTION"><input value={f.description} onChange={e => setF({...f, description: e.target.value})} className={inputClass} /></FormField>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="STATUS">
          <select value={f.status} onChange={e => setF({...f, status: e.target.value})} className={inputClass}>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="building">Building</option>
            <option value="paused">Paused</option>
          </select>
        </FormField>
        <FormField label="PROGRESS (%)"><input type="number" min="0" max="100" value={f.progress} onChange={e => setF({...f, progress: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="PRIORITY">
          <select value={f.priority} onChange={e => setF({...f, priority: e.target.value})} className={inputClass}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="TECH STACK"><input value={f.tech_stack} onChange={e => setF({...f, tech_stack: e.target.value})} placeholder="e.g. Next.js, Supabase" className={inputClass} /></FormField>
        <FormField label="TARGET LAUNCH"><input type="date" value={f.target_launch} onChange={e => setF({...f, target_launch: e.target.value})} className={inputClass} /></FormField>
      </div>
      <button type="submit" disabled={saving} className={btnClass}>{saving ? 'Saving...' : 'Add Project'}</button>
    </form>
  )
}

function TaskForm({ onSave, saving }: any) {
  const [f, setF] = useState({ title: '', due_date: '', priority: 'medium' })
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="space-y-0">
      <FormField label="TASK *"><input value={f.title} onChange={e => setF({...f, title: e.target.value})} placeholder="e.g. Complete payment gateway" className={inputClass} required /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="DUE DATE"><input type="date" value={f.due_date} onChange={e => setF({...f, due_date: e.target.value})} className={inputClass} /></FormField>
        <FormField label="PRIORITY">
          <select value={f.priority} onChange={e => setF({...f, priority: e.target.value})} className={inputClass}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </FormField>
      </div>
      <button type="submit" disabled={saving} className={btnClass}>{saving ? 'Saving...' : 'Add Task'}</button>
    </form>
  )
}

function HealthForm({ onSave, saving }: any) {
  const [f, setF] = useState({ date: new Date().toISOString().split('T')[0], sleep_hours: 0, steps: 0, water_glasses: 0, exercise_minutes: 0, mood: 3, energy_level: 3 })
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="space-y-0">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="SLEEP HOURS"><input type="number" step="0.5" value={f.sleep_hours || ''} onChange={e => setF({...f, sleep_hours: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="STEPS TODAY"><input type="number" value={f.steps || ''} onChange={e => setF({...f, steps: +e.target.value})} className={inputClass} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="WATER (GLASSES)"><input type="number" value={f.water_glasses || ''} onChange={e => setF({...f, water_glasses: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="EXERCISE (MINUTES)"><input type="number" value={f.exercise_minutes || ''} onChange={e => setF({...f, exercise_minutes: +e.target.value})} className={inputClass} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="MOOD (1-5)"><input type="number" min="1" max="5" value={f.mood} onChange={e => setF({...f, mood: +e.target.value})} className={inputClass} /></FormField>
        <FormField label="ENERGY (1-5)"><input type="number" min="1" max="5" value={f.energy_level} onChange={e => setF({...f, energy_level: +e.target.value})} className={inputClass} /></FormField>
      </div>
      <button type="submit" disabled={saving} className={btnClass}>{saving ? 'Saving...' : 'Log Health'}</button>
    </form>
  )
}

// ═══════════════════════════════════════════════════
// SETUP GUIDE — Step by step
// ═══════════════════════════════════════════════════

function SetupGuide() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white font-display mb-6">⚙️ Setup Guide</h2>

      <div className="space-y-4">
        {[
          {
            step: 1, title: 'Create Supabase Project',
            desc: 'Go to supabase.com → New Project → Copy your URL and anon key',
            link: 'https://supabase.com/dashboard',
          },
          {
            step: 2, title: 'Run Database Schema',
            desc: 'Go to Supabase SQL Editor → Paste the SQL from JENI-ARCHITECTURE.md → Click Run',
          },
          {
            step: 3, title: 'Enable Google Auth',
            desc: 'Supabase → Authentication → Providers → Enable Google → Add OAuth credentials from Google Cloud Console',
          },
          {
            step: 4, title: 'Get Groq API Key (FREE)',
            desc: 'Go to console.groq.com → Sign up → API Keys → Create Key',
            link: 'https://console.groq.com',
          },
          {
            step: 5, title: 'Set Environment Variables',
            desc: 'Copy .env.example to .env.local and fill in your Supabase URL, anon key, and Groq API key',
          },
          {
            step: 6, title: 'Deploy to Vercel',
            desc: 'Push code to GitHub → Go to vercel.com → Import repo → Add env variables → Deploy',
            link: 'https://vercel.com',
          },
          {
            step: 7, title: 'Add Your Data',
            desc: 'Go to the "My Data" tab and add your profile, salary, EMIs, subscriptions, and projects',
          },
          {
            step: 8, title: 'Talk to Jeni!',
            desc: 'Go to "Jeni AI" tab and start chatting. She knows everything you added!',
          },
        ].map(s => (
          <div key={s.step} className="flex gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center text-sm font-bold font-mono flex-shrink-0">
              {s.step}
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{s.title}</h3>
              <p className="text-gray-500 text-xs mt-1">{s.desc}</p>
              {s.link && (
                <a href={s.link} target="_blank" rel="noopener noreferrer"
                  className="text-purple-400 text-xs mt-1 inline-block hover:underline">
                  {s.link} →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
