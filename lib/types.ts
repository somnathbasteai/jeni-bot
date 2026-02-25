// ═══════════════════════════════════════════════════
// JENI LIFE OS — TypeScript Types
// These match your Supabase database tables
// ═══════════════════════════════════════════════════

export interface Profile {
  id: string
  user_id: string
  name: string
  email?: string
  phone?: string
  location?: string
  timezone: string
  blood_group?: string
  birthday?: string
  wake_time: string
  sleep_time: string
  work_start: string
  work_end: string
}

export interface Income {
  id: string
  user_id: string
  month: string
  year: number
  base_salary: number
  overtime: number
  bonus: number
  freelance: number
  passive_income: number
  deductions_pf: number
  deductions_tax: number
  deductions_other: number
  notes?: string
}

export interface Expense {
  id: string
  user_id: string
  amount: number
  category: string
  sub_category?: string
  description?: string
  payment_method?: string
  date: string
  is_recurring: boolean
}

export interface EMI {
  id: string
  user_id: string
  name: string
  lender?: string
  loan_type?: string
  principal_amount?: number
  interest_rate?: number
  emi_amount: number
  due_day?: number
  total_months?: number
  remaining_months?: number
  start_date?: string
  end_date?: string
  auto_debit: boolean
  status: string
}

export interface Subscription {
  id: string
  user_id: string
  name: string
  amount: number
  billing_cycle: string
  category?: string
  renewal_date?: string
  auto_renew: boolean
  is_essential: boolean
  status: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  status: string
  progress: number
  priority: string
  project_type?: string
  tech_stack?: string
  investment_total: number
  revenue_total: number
  target_launch?: string
  start_date?: string
  github_url?: string
  live_url?: string
}

export interface Task {
  id: string
  user_id: string
  project_id?: string
  title: string
  description?: string
  due_date?: string
  priority: string
  estimated_minutes?: number
  is_done: boolean
  tags?: string[]
}

export interface Goal {
  id: string
  user_id: string
  title: string
  description?: string
  category?: string
  target_value?: number
  current_value: number
  deadline?: string
  status: string
}

export interface HealthLog {
  id: string
  user_id: string
  date: string
  sleep_hours?: number
  sleep_quality?: number
  steps: number
  water_glasses: number
  exercise_type?: string
  exercise_minutes: number
  mood?: number
  energy_level?: number
  weight_kg?: number
}

export interface ScheduleItem {
  id: string
  user_id: string
  date: string
  time: string
  event: string
  type: string
  duration_minutes: number
  status: string
  is_recurring: boolean
  priority: string
}

export interface ChatMessage {
  id: string
  user_id: string
  session_id: string
  role: 'user' | 'jeni' | 'system'
  message: string
  model_used?: string
  created_at: string
}

// ── Supabase Database type (simplified) ──
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      income: { Row: Income; Insert: Partial<Income>; Update: Partial<Income> }
      expenses: { Row: Expense; Insert: Partial<Expense>; Update: Partial<Expense> }
      emis: { Row: EMI; Insert: Partial<EMI>; Update: Partial<EMI> }
      subscriptions: { Row: Subscription; Insert: Partial<Subscription>; Update: Partial<Subscription> }
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> }
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> }
      goals: { Row: Goal; Insert: Partial<Goal>; Update: Partial<Goal> }
      health_logs: { Row: HealthLog; Insert: Partial<HealthLog>; Update: Partial<HealthLog> }
      schedule: { Row: ScheduleItem; Insert: Partial<ScheduleItem>; Update: Partial<ScheduleItem> }
      chat_history: { Row: ChatMessage; Insert: Partial<ChatMessage>; Update: Partial<ChatMessage> }
    }
  }
}

// ── Life Context (built from all tables, sent to AI) ──
export interface LifeContext {
  profile: Profile | null
  currentTime: string
  finance: {
    latestIncome: Income | null
    netSalary: number
    activeEMIs: EMI[]
    totalEMI: number
    activeSubscriptions: Subscription[]
    totalSubs: number
    recentExpenses: Expense[]
    monthlyExpenseTotal: number
  }
  projects: Project[]
  pendingTasks: Task[]
  goals: Goal[]
  todaySchedule: ScheduleItem[]
  todayHealth: HealthLog | null
  recentChatContext: string
}
