import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildLifeContext, buildSystemPrompt } from '@/lib/context-engine'

// ═══════════════════════════════════════════════════
// /api/chat — Jeni's Brain Endpoint
//
// Flow:
// 1. User sends message from frontend
// 2. We get user ID from Supabase auth
// 3. Build FULL life context from ALL tables
// 4. Inject context into system prompt
// 5. Send to Groq (free) or Claude (paid)
// 6. Save chat to history
// 7. Return AI response
// ═══════════════════════════════════════════════════

// Server-side Supabase client
function getSupabaseServer(authHeader: string | null) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: authHeader || '' } }
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // ── 1. Authenticate user ──
    const authHeader = req.headers.get('authorization')
    const supabase = getSupabaseServer(authHeader)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // ── 2. Build full life context ──
    const context = await buildLifeContext(user.id)

    // ── 3. Build system prompt with context ──
    const systemPrompt = buildSystemPrompt(context)

    // ── 4. Get recent chat history for continuity ──
    const { data: recentChats } = await supabase
      .from('chat_history')
      .select('role, message')
      .eq('user_id', user.id)
      .eq('session_id', sessionId || '')
      .order('created_at', { ascending: true })
      .limit(20)

    const chatHistory = (recentChats || []).map(c => ({
      role: c.role === 'jeni' ? 'assistant' as const : 'user' as const,
      content: c.message,
    }))

    // ── 5. Call AI (Groq — FREE) ──
    let aiResponse = ''
    let modelUsed = 'groq'

    try {
      aiResponse = await callGroq(systemPrompt, chatHistory, message)
    } catch (groqError) {
      console.error('Groq failed, trying fallback:', groqError)
      // Fallback: simple context-based response
      aiResponse = generateFallbackResponse(message, context)
      modelUsed = 'fallback'
    }

    // ── 6. Save both messages to chat history ──
    const chatSession = sessionId || crypto.randomUUID()

    await supabase.from('chat_history').insert([
      {
        user_id: user.id,
        session_id: chatSession,
        role: 'user',
        message: message,
        model_used: modelUsed,
      },
      {
        user_id: user.id,
        session_id: chatSession,
        role: 'jeni',
        message: aiResponse,
        model_used: modelUsed,
      },
    ])

    // ── 7. Return response ──
    return NextResponse.json({
      reply: aiResponse,
      sessionId: chatSession,
      model: modelUsed,
    })

  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Try again.' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════
// GROQ AI CALL (FREE — 14,400 requests/day)
// ═══════════════════════════════════════════════════

async function callGroq(
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Groq API error: ${response.status} — ${errText}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || 'Sorry, I could not generate a response.'
}

// ═══════════════════════════════════════════════════
// FALLBACK (when AI APIs are down)
// ═══════════════════════════════════════════════════

function generateFallbackResponse(message: string, ctx: any): string {
  const q = message.toLowerCase()
  const name = ctx.profile?.name || 'there'

  if (q.includes('salary') || q.includes('income')) {
    return `Hey ${name}! Your net salary is ₹${ctx.finance.netSalary.toLocaleString('en-IN')}/month. EMIs take ₹${ctx.finance.totalEMI.toLocaleString('en-IN')} and subscriptions ₹${ctx.finance.totalSubs.toLocaleString('en-IN')}. (AI is temporarily offline, showing basic data)`
  }
  if (q.includes('emi') || q.includes('loan')) {
    return `You have ${ctx.finance.activeEMIs.length} active EMIs totaling ₹${ctx.finance.totalEMI.toLocaleString('en-IN')}/month. ${ctx.finance.activeEMIs.map((e: any) => `${e.name}: ₹${e.emi_amount}`).join(', ')}`
  }
  if (q.includes('project')) {
    return `Your projects: ${ctx.projects.map((p: any) => `${p.name} (${p.progress}%)`).join(', ')}`
  }
  return `Hey ${name}! I'm having trouble connecting to my AI brain right now. The basic data is available in the dashboard. Try again in a moment! 🙏`
}
