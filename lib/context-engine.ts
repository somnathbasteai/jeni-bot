import { supabase } from './supabase'
import type { LifeContext } from './types'

// ═══════════════════════════════════════════════════
// CONTEXT ENGINE — Builds full life context for AI
// This is what makes Jeni DIFFERENT from ChatGPT.
// Every AI call knows your ENTIRE life state.
// ═══════════════════════════════════════════════════

export async function buildLifeContext(userId: string): Promise<LifeContext> {
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 7) + '-01'

  // ── Fetch ALL data in parallel (fast!) ──
  const [
    profileRes,
    incomeRes,
    emisRes,
    subsRes,
    expensesRes,
    projectsRes,
    tasksRes,
    goalsRes,
    scheduleRes,
    healthRes,
    chatRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).single(),
    supabase.from('income').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
    supabase.from('emis').select('*').eq('user_id', userId).eq('status', 'active'),
    supabase.from('subscriptions').select('*').eq('user_id', userId).eq('status', 'active'),
    supabase.from('expenses').select('*').eq('user_id', userId).gte('date', monthStart).order('date', { ascending: false }),
    supabase.from('projects').select('*').eq('user_id', userId).order('priority', { ascending: true }),
    supabase.from('tasks').select('*').eq('user_id', userId).eq('is_done', false).order('due_date', { ascending: true }).limit(20),
    supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'in_progress'),
    supabase.from('schedule').select('*').eq('user_id', userId).eq('date', today).order('time', { ascending: true }),
    supabase.from('health_logs').select('*').eq('user_id', userId).eq('date', today).single(),
    supabase.from('chat_history').select('message, role').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ])

  const latestIncome = incomeRes.data?.[0] || null
  const activeEMIs = emisRes.data || []
  const activeSubs = subsRes.data || []
  const recentExpenses = expensesRes.data || []

  const netSalary = latestIncome
    ? latestIncome.base_salary + latestIncome.overtime + latestIncome.bonus + latestIncome.freelance + latestIncome.passive_income
      - latestIncome.deductions_pf - latestIncome.deductions_tax - latestIncome.deductions_other
    : 0

  const totalEMI = activeEMIs.reduce((sum, e) => sum + e.emi_amount, 0)
  const totalSubs = activeSubs.reduce((sum, s) => sum + s.amount, 0)
  const monthlyExpenseTotal = recentExpenses.reduce((sum, e) => sum + e.amount, 0)

  // Build recent chat context for continuity
  const recentChatContext = (chatRes.data || [])
    .reverse()
    .map(m => `${m.role}: ${m.message}`)
    .join('\n')

  return {
    profile: profileRes.data || null,
    currentTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    finance: {
      latestIncome,
      netSalary,
      activeEMIs,
      totalEMI,
      activeSubscriptions: activeSubs,
      totalSubs,
      recentExpenses,
      monthlyExpenseTotal,
    },
    projects: projectsRes.data || [],
    pendingTasks: tasksRes.data || [],
    goals: goalsRes.data || [],
    todaySchedule: scheduleRes.data || [],
    todayHealth: healthRes.data || null,
    recentChatContext,
  }
}

// ═══════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER — Turns context into AI instructions
// ═══════════════════════════════════════════════════

export function buildSystemPrompt(ctx: LifeContext): string {
  const name = ctx.profile?.name || 'User'
  const location = ctx.profile?.location || 'India'

  return `You are Jeni, ${name}'s personal life intelligence system.

## YOUR PERSONALITY
- Talk like a smart, caring friend — not a corporate AI
- Be SPECIFIC — use actual numbers from the data below
- Be PROACTIVE — mention important things even if not asked
- Use Hindi words occasionally if natural (bhai, yaar, chal)
- Challenge ${name} when needed ("Bro, you slept 5 hrs again")
- Celebrate wins ("DigiKaragir hit 65%! Let's go!")
- Keep responses focused and actionable

## ${name.toUpperCase()}'S CURRENT LIFE STATE

### Identity
- Name: ${name}
- Location: ${location}
- Current time: ${ctx.currentTime}

### Finance
${ctx.finance.latestIncome ? `- Net Salary: ₹${ctx.finance.netSalary.toLocaleString('en-IN')}/month (${ctx.finance.latestIncome.month} ${ctx.finance.latestIncome.year})
- Base: ₹${ctx.finance.latestIncome.base_salary.toLocaleString('en-IN')} | OT: ₹${ctx.finance.latestIncome.overtime.toLocaleString('en-IN')} | Deductions: ₹${(ctx.finance.latestIncome.deductions_pf + ctx.finance.latestIncome.deductions_tax + ctx.finance.latestIncome.deductions_other).toLocaleString('en-IN')}` : '- No income data yet. Ask user to add their salary info.'}
- Total EMI: ₹${ctx.finance.totalEMI.toLocaleString('en-IN')}/month (${ctx.finance.activeEMIs.length} active)
${ctx.finance.activeEMIs.map(e => `  • ${e.name}: ₹${e.emi_amount.toLocaleString('en-IN')}/mo, due ${e.due_day}th, ${e.remaining_months} months left, ${e.lender || 'unknown lender'}`).join('\n')}
- Total Subscriptions: ₹${ctx.finance.totalSubs.toLocaleString('en-IN')}/month (${ctx.finance.activeSubscriptions.length} active)
${ctx.finance.activeSubscriptions.map(s => `  • ${s.name}: ₹${s.amount.toLocaleString('en-IN')}/${s.billing_cycle} [${s.is_essential ? 'ESSENTIAL' : 'OPTIONAL'}]`).join('\n')}
- Monthly Expenses so far: ₹${ctx.finance.monthlyExpenseTotal.toLocaleString('en-IN')}
- Free cash (salary - EMI - subs): ₹${(ctx.finance.netSalary - ctx.finance.totalEMI - ctx.finance.totalSubs).toLocaleString('en-IN')}

### Projects (${ctx.projects.length})
${ctx.projects.length > 0 ? ctx.projects.map(p => `- ${p.name}: ${p.progress}% done | ${p.status} | Priority: ${p.priority}${p.target_launch ? ` | Launch: ${p.target_launch}` : ''}${p.tech_stack ? ` | Stack: ${p.tech_stack}` : ''}`).join('\n') : '- No projects yet. Help user add their projects.'}

### Pending Tasks (${ctx.pendingTasks.length})
${ctx.pendingTasks.length > 0 ? ctx.pendingTasks.slice(0, 10).map(t => `- ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ''} [${t.priority}]`).join('\n') : '- No pending tasks.'}

### Goals
${ctx.goals.length > 0 ? ctx.goals.map(g => `- ${g.title}: ${g.current_value}/${g.target_value || '?'} | ${g.category} | Deadline: ${g.deadline || 'none'}`).join('\n') : '- No goals set yet. Help user define goals.'}

### Today's Schedule
${ctx.todaySchedule.length > 0 ? ctx.todaySchedule.map(s => `- ${s.time} ${s.event} [${s.type}] ${s.status === 'done' ? '✅' : s.status === 'active' ? '🔴 NOW' : '⏳'}`).join('\n') : '- No schedule for today. Help user plan their day.'}

### Health Today
${ctx.todayHealth ? `- Sleep: ${ctx.todayHealth.sleep_hours || '?'} hrs | Steps: ${ctx.todayHealth.steps} | Water: ${ctx.todayHealth.water_glasses} glasses | Exercise: ${ctx.todayHealth.exercise_minutes} min` : '- No health data logged today. Remind user to log.'}

## IMPORTANT RULES
1. ALWAYS use real numbers from the data above
2. If data is missing, tell user: "I don't have that data yet — let's add it! Go to [section]"
3. Mention concerning things proactively (low sleep, upcoming EMI, deadline)
4. Give SPECIFIC, ACTIONABLE advice (not generic)
5. Reference projects by name
6. If user asks about something not in the data, say so honestly
7. Format financial amounts in Indian notation (₹XX,XXX)
8. Keep responses concise but comprehensive
9. If a section has no data, suggest adding it rather than making up data`
}
