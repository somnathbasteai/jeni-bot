import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildLifeContext, buildSystemPrompt } from '@/lib/context-engine'

// ═══════════════════════════════════════════════════
// JENI BRAIN + DATA WRITER
//
// Now Jeni can SAVE data from chat:
// "add sub Netflix 649"
// "add emi bike 4500 due 5th 18 months HDFC"
// "my salary is 45000 overtime 8500"
// "add project DigiKaragir 65%"
// "task: fix login bug"
// "spent 500 on food"
// "slept 7 hours, 5000 steps, 4 glasses water"
// ═══════════════════════════════════════════════════

function getUserSupabase(token: string | null) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: token ? `Bearer ${token}` : '' } } }
  )
}

// Admin client bypasses RLS — needed to write data
function getAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const authHeader = req.headers.get('authorization')
    const supabase = getUserSupabase(authHeader)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // ── 1. Try data command first ──
    const dataResult = await tryDataCommand(message, user.id)
    if (dataResult) {
      const sid = sessionId || crypto.randomUUID()
      await saveChat(supabase, user.id, sid, message, dataResult)
      return NextResponse.json({ reply: dataResult, sessionId: sid, model: 'data-engine' })
    }

    // ── 2. Normal AI chat ──
    const context = await buildLifeContext(user.id)
    const sysPrompt = buildSystemPrompt(context) + DATA_HINT

    const { data: history } = await supabase
      .from('chat_history').select('role, message')
      .eq('user_id', user.id).eq('session_id', sessionId || '')
      .order('created_at', { ascending: true }).limit(20)

    const msgs = (history || []).map(c => ({
      role: c.role === 'jeni' ? 'assistant' as const : 'user' as const,
      content: c.message,
    }))

    let reply = '', model = 'groq'
    try {
      reply = await callGroq(sysPrompt, msgs, message)
    } catch {
      reply = `Hey ${context.profile?.name || 'there'}! AI brain is briefly offline. Try again in a sec! 🙏`
      model = 'fallback'
    }

    const sid = sessionId || crypto.randomUUID()
    await saveChat(supabase, user.id, sid, message, reply)
    return NextResponse.json({ reply, sessionId: sid, model })

  } catch (err: any) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

const DATA_HINT = `\n\n## USER CAN ADD DATA VIA CHAT
If the user wants to add data, tell them these commands work:
- "add sub [name] [amount]" → adds subscription
- "add emi [name] [amount] due [day] [months] months [bank]" → adds EMI
- "my salary is [base] overtime [ot] pf [pf] tax [tax]" → saves salary
- "add project [name] [progress]%" → adds project
- "task: [description]" or "todo: [description]" → adds task
- "spent [amount] on [category]" → logs expense
- "slept [hours] hours, [steps] steps, [glasses] water" → logs health
- "add goal [title]" → adds goal
- "my name is [name]" → updates profile`

// ═══════════════════════════════════════════════════
// DATA COMMAND PARSER
// ═══════════════════════════════════════════════════

async function tryDataCommand(msg: string, userId: string): Promise<string | null> {
  const m = msg.toLowerCase().trim()
  const db = getAdminSupabase()

  // ── SUBSCRIPTION ──
  if (/add\s+(sub|subscription)/i.test(m)) {
    const cleaned = m.replace(/add\s+(sub|subscription)\s*/i, '')
    const amount = extractNum(cleaned)
    const name = cleaned.replace(/₹?\s*\d[\d,.]*/g, '').replace(/(monthly|yearly|essential|entertainment|business|tools|health)/gi, '').trim()
    const cycle = m.includes('yearly') ? 'yearly' : 'monthly'
    const cat = detectCat(m)

    if (name && amount !== null) {
      const { error } = await db.from('subscriptions').insert({
        user_id: userId, name: cap(name), amount, billing_cycle: cycle,
        category: cat, is_essential: m.includes('essential'), status: 'active',
      })
      if (error) return `❌ Error: ${error.message}`
      return `✅ Subscription added!\n\n📌 ${cap(name)} — ₹${amount.toLocaleString('en-IN')}/${cycle}\n📂 Category: ${cat}\n\nWant to add more? Or say "my subscriptions" to see all.`
    }
    return `I couldn't parse that. Try: "add sub Netflix 649" or "add sub Spotify 119 monthly entertainment"`
  }

  // ── EMI ──
  if (/add\s+emi/i.test(m)) {
    const cleaned = m.replace(/add\s+emi\s*/i, '')
    const amount = extractNum(cleaned)
    const dueMatch = m.match(/due\s+(\d{1,2})/i)
    const dueDay = dueMatch ? parseInt(dueMatch[1]) : 1
    const monthMatch = m.match(/(\d+)\s*month/i)
    const months = monthMatch ? parseInt(monthMatch[1]) : 12
    const lender = findLender(m)
    const name = cleaned
      .replace(/₹?\s*\d[\d,.]*/g, '').replace(/due\s+\d+\w*/gi, '')
      .replace(/\d+\s*months?\s*\w*/gi, '').replace(/(hdfc|sbi|icici|bajaj|axis|kotak|pnb|bob|idfc|yes\s*bank)/gi, '')
      .replace(/(remaining|left|monthly|loan|interest|per)/gi, '').trim()

    if (amount) {
      const { error } = await db.from('emis').insert({
        user_id: userId, name: cap(name || 'EMI'), emi_amount: amount,
        due_day: dueDay, remaining_months: months, total_months: months + 6,
        lender, status: 'active',
      })
      if (error) return `❌ Error: ${error.message}`
      return `✅ EMI added!\n\n📌 ${cap(name || 'EMI')}\n💰 ₹${amount.toLocaleString('en-IN')}/month\n📅 Due: ${dueDay}th\n⏳ ${months} months remaining${lender ? `\n🏦 ${lender}` : ''}\n\nSay "my EMIs" to see all.`
    }
    return `Try: "add emi Bike Loan 4500 due 5th 18 months HDFC"`
  }

  // ── SALARY ──
  if (/(?:my\s+)?salary|set\s+salary|income\s+is/i.test(m) && /\d/.test(m)) {
    const nums = [...m.matchAll(/(\d+)/g)].map(x => parseInt(x[1]))
    if (nums.length >= 1) {
      const base = nums[0], ot = nums[1] || 0, bonus = nums[2] || 0
      const pf = nums[3] || 0, tax = nums[4] || 0
      const now = new Date()
      const { error } = await db.from('income').insert({
        user_id: userId, month: now.toLocaleString('en-US', { month: 'long' }),
        year: now.getFullYear(), base_salary: base, overtime: ot, bonus,
        deductions_pf: pf, deductions_tax: tax, deductions_other: 0,
      })
      if (error) return `❌ Error: ${error.message}`
      const net = base + ot + bonus - pf - tax
      return `✅ Salary saved!\n\n💼 Base: ₹${base.toLocaleString('en-IN')}\n⏰ OT: ₹${ot.toLocaleString('en-IN')}\n📉 PF: -₹${pf.toLocaleString('en-IN')} | Tax: -₹${tax.toLocaleString('en-IN')}\n━━━━━━━━━━━━\n🏦 Net: ₹${net.toLocaleString('en-IN')}\n\nAsk "how's my money?" for full analysis!`
    }
  }

  // ── PROJECT ──
  if (/add\s+project/i.test(m)) {
    const cleaned = m.replace(/add\s+project\s*/i, '')
    const progress = extractNum(cleaned) || 0
    const name = cleaned.replace(/\d+%?/g, '').replace(/(active|building|planned|critical|high|medium|low)/gi, '').trim()
    const status = m.includes('building') ? 'building' : m.includes('planned') ? 'planned' : 'active'
    const priority = m.includes('critical') ? 'critical' : m.includes('high') ? 'high' : 'medium'

    if (name) {
      const { error } = await db.from('projects').insert({
        user_id: userId, name: cap(name), status, progress: Math.min(progress, 100), priority,
      })
      if (error) return `❌ Error: ${error.message}`
      return `✅ Project added!\n\n🚀 ${cap(name)} — ${progress}% done\n📌 ${status} | Priority: ${priority}\n\nSay "project status" to see all projects.`
    }
  }

  // ── TASK ──
  if (/^(?:add\s+)?(?:task|todo|reminder)[:\s]+/i.test(m)) {
    const title = m.replace(/^(?:add\s+)?(?:task|todo|reminder)[:\s]+/i, '').trim()
    if (title) {
      const priority = m.includes('urgent') ? 'high' : 'medium'
      const { error } = await db.from('tasks').insert({
        user_id: userId, title: cap(title), priority, is_done: false,
      })
      if (error) return `❌ Error: ${error.message}`
      return `✅ Task added: "${cap(title)}"\n\nSay "my tasks" to see all pending.`
    }
  }

  // ── EXPENSE ──
  if (/spent|expense|paid|kharcha/i.test(m) && /\d/.test(m)) {
    const amount = extractNum(m)
    const cat = detectExpCat(m)
    if (amount) {
      const desc = m.replace(/\d+/g, '').replace(/(spent|expense|paid|kharcha|on|for|add|₹)/gi, '').trim()
      const { error } = await db.from('expenses').insert({
        user_id: userId, amount, category: cat,
        description: cap(desc) || cat, date: new Date().toISOString().split('T')[0],
      })
      if (error) return `❌ Error: ${error.message}`
      return `✅ Expense: ₹${amount.toLocaleString('en-IN')} on ${cat}\n\nSay "my expenses" to see this month's spending.`
    }
  }

  // ── HEALTH ──
  if (/slept|log\s+health|steps.*water|water.*steps/i.test(m)) {
    const sleep = valAfter(m, ['sleep', 'slept'])
    const steps = valAfter(m, ['steps', 'walked'])
    const water = valAfter(m, ['water', 'glasses'])
    const exercise = valAfter(m, ['gym', 'exercise', 'workout'])

    if (sleep || steps || water || exercise) {
      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await db.from('health_logs').select('id').eq('user_id', userId).eq('date', today).single()

      const data: any = {}
      if (sleep) data.sleep_hours = sleep
      if (steps) data.steps = steps
      if (water) data.water_glasses = water
      if (exercise) data.exercise_minutes = exercise

      if (existing) {
        await db.from('health_logs').update(data).eq('id', existing.id)
      } else {
        await db.from('health_logs').insert({ user_id: userId, date: today, mood: 3, ...data })
      }

      let r = `✅ Health logged!\n\n`
      if (sleep) r += `😴 Sleep: ${sleep}h\n`
      if (steps) r += `🚶 Steps: ${steps.toLocaleString()}\n`
      if (water) r += `💧 Water: ${water} glasses\n`
      if (exercise) r += `🏋️ Exercise: ${exercise}min\n`
      return r + `\nSay "my health" for full analysis.`
    }
  }

  // ── GOAL ──
  if (/add\s+goal/i.test(m)) {
    const title = m.replace(/add\s+goal\s*/i, '').trim()
    if (title) {
      const cat = /business|launch/i.test(m) ? 'business' : /finance|money|save/i.test(m) ? 'finance' : /health|gym|fit/i.test(m) ? 'health' : 'personal'
      await db.from('goals').insert({ user_id: userId, title: cap(title), category: cat, status: 'in_progress', current_value: 0 })
      return `✅ Goal added: "${cap(title)}" [${cat}]\n\nSay "my goals" to track progress.`
    }
  }

  // ── NAME / PROFILE ──
  if (/my name is|i am|call me/i.test(m)) {
    const nameMatch = m.match(/(?:my name is|i am|call me)\s+(.+)/i)
    if (nameMatch) {
      const name = cap(nameMatch[1].trim())
      const { data: existing } = await db.from('profiles').select('id').eq('user_id', userId).single()
      if (existing) await db.from('profiles').update({ name }).eq('user_id', userId)
      else await db.from('profiles').insert({ user_id: userId, name })
      return `✅ Got it! Hey ${name}! 👋 I'll remember your name.`
    }
  }

  return null // Not a data command → go to AI
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function extractNum(t: string): number | null {
  const m = t.match(/₹?\s*(\d[\d,]*(?:\.\d+)?)/); return m ? parseFloat(m[1].replace(/,/g, '')) : null
}
function valAfter(t: string, kws: string[]): number | null {
  for (const k of kws) {
    const m = t.match(new RegExp(`${k}\\s*(\\d+\\.?\\d*)`, 'i')) || t.match(new RegExp(`(\\d+\\.?\\d*)\\s*${k}`, 'i'))
    if (m) return parseFloat(m[1])
  } return null
}
function cap(s: string): string { return s.replace(/\b\w/g, c => c.toUpperCase()) }
function findLender(t: string): string | null {
  for (const l of ['hdfc', 'sbi', 'icici', 'bajaj', 'axis', 'kotak', 'pnb', 'bob', 'idfc']) {
    if (t.includes(l)) return l.toUpperCase()
  } return null
}
function detectCat(t: string): string {
  if (/netflix|spotify|prime|disney|youtube|hotstar/i.test(t)) return 'entertainment'
  if (/aws|vercel|hosting|domain|server/i.test(t)) return 'business'
  if (/gym|health|fitness/i.test(t)) return 'health'
  if (/github|figma|notion|tool/i.test(t)) return 'tools'
  return 'other'
}
function detectExpCat(t: string): string {
  if (/food|lunch|dinner|breakfast|zomato|swiggy|eat|chai/i.test(t)) return 'food'
  if (/petrol|fuel|uber|ola|bus|train|auto|transport/i.test(t)) return 'transport'
  if (/electric|rent|bill|wifi|recharge/i.test(t)) return 'utilities'
  if (/shopping|amazon|flipkart|clothes/i.test(t)) return 'shopping'
  if (/doctor|medical|medicine/i.test(t)) return 'medical'
  return 'other'
}

// ═══════════════════════════════════════════════════
// GROQ AI
// ═══════════════════════════════════════════════════

async function callGroq(sys: string, history: any[], msg: string): Promise<string> {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: msg }],
      temperature: 0.7, max_tokens: 1500,
    }),
  })
  if (!r.ok) throw new Error(`Groq: ${r.status}`)
  const d = await r.json()
  return d.choices[0]?.message?.content || 'Could not respond.'
}

// ═══════════════════════════════════════════════════
// SAVE CHAT
// ═══════════════════════════════════════════════════

async function saveChat(sb: any, uid: string, sid: string, userMsg: string, jeniMsg: string) {
  try {
    await sb.from('chat_history').insert([
      { user_id: uid, session_id: sid, role: 'user', message: userMsg },
      { user_id: uid, session_id: sid, role: 'jeni', message: jeniMsg },
    ])
  } catch (e) { console.error('Chat save failed:', e) }
}
