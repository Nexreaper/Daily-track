import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./utils/cn";

type WeightUnit = "kg" | "lb";
type Religion = "islam" | "christianity" | "hinduism" | "buddhism" | "other";
type ReligionPractice = "prayers" | "scripture" | "puja" | "meditation" | null;
type GoalKey = "habit" | "exercise" | "reading" | "writing" | "water" | "sleep" | "savings" | "spiritual";
type TabKey = "home" | "sleep" | "looks";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
type LookTaskKey =
  | "cleanse_am"
  | "moisturize_am"
  | "spf"
  | "posture"
  | "mewing"
  | "hair"
  | "grooming"
  | "stretching"
  | "confidence"
  | "hydration";

interface SleepSession {
  start: string;
  end: string;
  durationMin: number;
  date: string;
}

interface DayLog {
  prayers: Record<PrayerKey, boolean>;
  spiritual: boolean;
  exerciseCount: number;
  exerciseDone: boolean;
  reading: boolean;
  writing: boolean;
  water: number;
  sleep: boolean;
  sleepDurationMin: number;
  looks: Record<LookTaskKey, boolean>;
}

interface CheckinEntry {
  timestamp: string;
  text: string;
  source?: "manual" | "notification";
}

interface Profile {
  id: string;
  name: string;
  age: number;
  weight: number;
  weightUnit: WeightUnit;
  religion: Religion;
  religionPractice: ReligionPractice;
  religionPracticeLabel: string;
  goals: GoalKey[];
  habitName: string;
  pushupTarget: number;
  careerGoal: string;
  futureSelf: string;
  lastRelapseDate: string;
  habitStartDate: string;
  roadmapProgress: Record<string, boolean>;
  createdAt: string;
  savingsGoalName: string;
  savingsTarget: number;
  savingsCurrent: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  currency: string;
  savingsLog: Record<string, number>;
  sleepStatus: "awake" | "asleep";
  sleepStartedAt: string | null;
  sleepSessions: SleepSession[];
  sleepTargetHours: number;
  prayerTimes: Record<CapitalizedPrayerKey, string>;
  checkinEnabled: boolean;
}

type CapitalizedPrayerKey = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

interface LogsStore {
  checkins: CheckinEntry[];
  [date: string]: DayLog | CheckinEntry[] | undefined;
}

interface OnboardingDraft {
  name: string;
  age: string;
  weight: string;
  weightUnit: WeightUnit;
  religion: Religion;
  religionPractice: ReligionPractice;
  religionPracticeLabel: string;
  goals: Record<GoalKey, boolean>;
  habitName: string;
  pushupTarget: string;
  careerGoal: string;
  futureSelf: string;
  savingsGoalName: string;
  savingsTarget: string;
  savingsCurrent: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  currency: string;
}

interface NotificationState {
  prayerSent: Record<string, string[]>;
  lastRandomCheckinAt: string | null;
}

const STORAGE = {
  profile: "profile",
  logs: "logs",
  notificationState: "notificationState",
} as const;

const DEFAULT_PRAYER_TIMES: Record<CapitalizedPrayerKey, string> = {
  Fajr: "05:00",
  Dhuhr: "12:30",
  Asr: "15:45",
  Maghrib: "18:45",
  Isha: "20:00",
};

const GOAL_KEYS: GoalKey[] = ["habit", "exercise", "reading", "writing", "water", "sleep", "savings", "spiritual"];

const LOOK_TASKS: Array<{ key: LookTaskKey; label: string }> = [
  { key: "cleanse_am", label: "Cleanse" },
  { key: "moisturize_am", label: "Moisturize" },
  { key: "spf", label: "SPF" },
  { key: "posture", label: "Posture" },
  { key: "mewing", label: "Mewing" },
  { key: "hair", label: "Hair" },
  { key: "grooming", label: "Grooming" },
  { key: "stretching", label: "Stretching" },
  { key: "confidence", label: "Confidence" },
  { key: "hydration", label: "Hydration" },
];

const ROADMAP: Array<{
  stage: string;
  key: string;
  steps: Array<{ key: string; label: string }>;
}> = [
  {
    stage: "Foundation",
    key: "foundation",
    steps: [
      { key: "clarify-role", label: "Clarify the role you want." },
      { key: "daily-routine", label: "Lock in a repeatable daily routine." },
      { key: "journal-focus", label: "Write one focused journal entry each day." },
    ],
  },
  {
    stage: "Skill Build",
    key: "skill-build",
    steps: [
      { key: "portfolio-project", label: "Ship one portfolio project." },
      { key: "practice-block", label: "Complete a deep practice block." },
      { key: "documentation", label: "Document what you are learning." },
    ],
  },
  {
    stage: "Momentum",
    key: "momentum",
    steps: [
      { key: "networking", label: "Reach out to one useful contact." },
      { key: "applications", label: "Send targeted applications." },
      { key: "review", label: "Review the week and adjust the plan." },
    ],
  },
  {
    stage: "Leadership",
    key: "leadership",
    steps: [
      { key: "mentor", label: "Help someone else improve." },
      { key: "own-outcome", label: "Own a clear weekly outcome." },
    ],
  },
] as const;

const STATIC_LOOKS_TIPS = [
  "Keep your haircut and beard shape consistent.",
  "Sleep and hydration usually show up before products do.",
  "Stand tall and move slower than your nerves want you to.",
  "Use one simple routine long enough to see what works.",
];

const DEFAULT_GOALS: Record<GoalKey, boolean> = {
  habit: true,
  exercise: true,
  reading: true,
  writing: true,
  water: true,
  sleep: true,
  savings: true,
  spiritual: true,
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function uid() {
  return `ledger-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createDefaultDayLog(): DayLog {
  return {
    prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
    spiritual: false,
    exerciseCount: 0,
    exerciseDone: false,
    reading: false,
    writing: false,
    water: 0,
    sleep: false,
    sleepDurationMin: 0,
    looks: {
      cleanse_am: false,
      moisturize_am: false,
      spf: false,
      posture: false,
      mewing: false,
      hair: false,
      grooming: false,
      stretching: false,
      confidence: false,
      hydration: false,
    },
  };
}

function createInitialProfile(draft: OnboardingDraft): Profile {
  const roadmapProgress = ROADMAP.flatMap((stage) => stage.steps).reduce<Record<string, boolean>>((acc, step) => {
    acc[step.key] = false;
    return acc;
  }, {});

  return {
    id: uid(),
    name: draft.name.trim() || "Nexreaper",
    age: Number(draft.age) || 18,
    weight: Number(draft.weight) || 0,
    weightUnit: draft.weightUnit,
    religion: draft.religion,
    religionPractice: draft.religionPractice,
    religionPracticeLabel: draft.religionPracticeLabel.trim() || "Daily practice",
    goals: GOAL_KEYS.filter((key) => draft.goals[key]),
    habitName: draft.habitName.trim() || "main habit",
    pushupTarget: Math.max(1, Number(draft.pushupTarget) || 20),
    careerGoal: draft.careerGoal.trim() || "Build a stronger career path.",
    futureSelf: draft.futureSelf.trim(),
    lastRelapseDate: localDateKey(),
    habitStartDate: localDateKey(),
    roadmapProgress,
    createdAt: localDateKey(),
    savingsGoalName: draft.savingsGoalName.trim() || "Savings goal",
    savingsTarget: Math.max(0, Number(draft.savingsTarget) || 0),
    savingsCurrent: Math.max(0, Number(draft.savingsCurrent) || 0),
    monthlyIncome: Math.max(0, Number(draft.monthlyIncome) || 0),
    monthlyExpenses: Math.max(0, Number(draft.monthlyExpenses) || 0),
    currency: draft.currency.trim() || "USD",
    savingsLog: {},
    sleepStatus: "awake",
    sleepStartedAt: null,
    sleepSessions: [],
    sleepTargetHours: 7.5,
    prayerTimes: DEFAULT_PRAYER_TIMES,
    checkinEnabled: true,
  };
}

function normalizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<Profile>;
  return {
    id: typeof data.id === "string" ? data.id : uid(),
    name: typeof data.name === "string" ? data.name : "Nexreaper",
    age: Number(data.age) || 18,
    weight: Number(data.weight) || 0,
    weightUnit: data.weightUnit === "lb" ? "lb" : "kg",
    religion:
      data.religion === "christianity" || data.religion === "hinduism" || data.religion === "buddhism" || data.religion === "other"
        ? data.religion
        : "islam",
    religionPractice:
      data.religionPractice === "scripture" || data.religionPractice === "puja" || data.religionPractice === "meditation" || data.religionPractice === "prayers"
        ? data.religionPractice
        : null,
    religionPracticeLabel: typeof data.religionPracticeLabel === "string" ? data.religionPracticeLabel : "Daily practice",
    goals: Array.isArray(data.goals) ? data.goals.filter((goal): goal is GoalKey => GOAL_KEYS.includes(goal as GoalKey)) : GOAL_KEYS,
    habitName: typeof data.habitName === "string" ? data.habitName : "main habit",
    pushupTarget: Number(data.pushupTarget) || 20,
    careerGoal: typeof data.careerGoal === "string" ? data.careerGoal : "Build a stronger career path.",
    futureSelf: typeof data.futureSelf === "string" ? data.futureSelf : "",
    lastRelapseDate: typeof data.lastRelapseDate === "string" ? data.lastRelapseDate : localDateKey(),
    habitStartDate: typeof data.habitStartDate === "string" ? data.habitStartDate : localDateKey(),
    roadmapProgress: typeof data.roadmapProgress === "object" && data.roadmapProgress ? (data.roadmapProgress as Record<string, boolean>) : {},
    createdAt: typeof data.createdAt === "string" ? data.createdAt : localDateKey(),
    savingsGoalName: typeof data.savingsGoalName === "string" ? data.savingsGoalName : "Savings goal",
    savingsTarget: Number(data.savingsTarget) || 0,
    savingsCurrent: Number(data.savingsCurrent) || 0,
    monthlyIncome: Number(data.monthlyIncome) || 0,
    monthlyExpenses: Number(data.monthlyExpenses) || 0,
    currency: typeof data.currency === "string" ? data.currency : "USD",
    savingsLog: typeof data.savingsLog === "object" && data.savingsLog ? (data.savingsLog as Record<string, number>) : {},
    sleepStatus: data.sleepStatus === "asleep" ? "asleep" : "awake",
    sleepStartedAt: typeof data.sleepStartedAt === "string" ? data.sleepStartedAt : null,
    sleepSessions: Array.isArray(data.sleepSessions)
      ? data.sleepSessions.filter(
          (session): session is SleepSession =>
            typeof session === "object" &&
            session !== null &&
            typeof session.start === "string" &&
            typeof session.end === "string" &&
            typeof session.durationMin === "number" &&
            typeof session.date === "string",
        )
      : [],
    sleepTargetHours: Number(data.sleepTargetHours) || 7.5,
    prayerTimes: {
      Fajr: typeof data.prayerTimes?.Fajr === "string" ? data.prayerTimes.Fajr : DEFAULT_PRAYER_TIMES.Fajr,
      Dhuhr: typeof data.prayerTimes?.Dhuhr === "string" ? data.prayerTimes.Dhuhr : DEFAULT_PRAYER_TIMES.Dhuhr,
      Asr: typeof data.prayerTimes?.Asr === "string" ? data.prayerTimes.Asr : DEFAULT_PRAYER_TIMES.Asr,
      Maghrib: typeof data.prayerTimes?.Maghrib === "string" ? data.prayerTimes.Maghrib : DEFAULT_PRAYER_TIMES.Maghrib,
      Isha: typeof data.prayerTimes?.Isha === "string" ? data.prayerTimes.Isha : DEFAULT_PRAYER_TIMES.Isha,
    },
    checkinEnabled: data.checkinEnabled !== false,
  };
}

function normalizeLogs(raw: unknown): LogsStore {
  const next: LogsStore = { checkins: [] };
  if (!raw || typeof raw !== "object") return next;
  const data = raw as Record<string, unknown>;
  if (Array.isArray(data.checkins)) {
    next.checkins = data.checkins.filter(
      (item): item is CheckinEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CheckinEntry).timestamp === "string" &&
        typeof (item as CheckinEntry).text === "string",
    );
  }
  for (const [key, value] of Object.entries(data)) {
    if (key === "checkins") continue;
    if (typeof value === "object" && value && !Array.isArray(value)) {
      const candidate = value as Partial<DayLog>;
      next[key] = {
        prayers: {
          fajr: Boolean(candidate.prayers?.fajr),
          dhuhr: Boolean(candidate.prayers?.dhuhr),
          asr: Boolean(candidate.prayers?.asr),
          maghrib: Boolean(candidate.prayers?.maghrib),
          isha: Boolean(candidate.prayers?.isha),
        },
        spiritual: Boolean(candidate.spiritual),
        exerciseCount: Number(candidate.exerciseCount) || 0,
        exerciseDone: Boolean(candidate.exerciseDone),
        reading: Boolean(candidate.reading),
        writing: Boolean(candidate.writing),
        water: Number(candidate.water) || 0,
        sleep: Boolean(candidate.sleep),
        sleepDurationMin: Number(candidate.sleepDurationMin) || 0,
        looks: {
          cleanse_am: Boolean(candidate.looks?.cleanse_am),
          moisturize_am: Boolean(candidate.looks?.moisturize_am),
          spf: Boolean(candidate.looks?.spf),
          posture: Boolean(candidate.looks?.posture),
          mewing: Boolean(candidate.looks?.mewing),
          hair: Boolean(candidate.looks?.hair),
          grooming: Boolean(candidate.looks?.grooming),
          stretching: Boolean(candidate.looks?.stretching),
          confidence: Boolean(candidate.looks?.confidence),
          hydration: Boolean(candidate.looks?.hydration),
        },
      };
    }
  }
  return next;
}

function createNotificationState(raw: unknown): NotificationState {
  if (!raw || typeof raw !== "object") {
    return { prayerSent: {}, lastRandomCheckinAt: null };
  }
  const data = raw as Partial<NotificationState>;
  return {
    prayerSent: typeof data.prayerSent === "object" && data.prayerSent ? (data.prayerSent as Record<string, string[]>) : {},
    lastRandomCheckinAt: typeof data.lastRandomCheckinAt === "string" ? data.lastRandomCheckinAt : null,
  };
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`);
}

function diffDays(later: string, earlier: string) {
  const laterDate = startOfDay(later).getTime();
  const earlierDate = startOfDay(earlier).getTime();
  return Math.max(0, Math.floor((laterDate - earlierDate) / 86_400_000));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getDayLog(logs: LogsStore, dateKey: string, profile: Profile | null) {
  const current = logs[dateKey];
  if (current && !Array.isArray(current)) return current as DayLog;
  return profile ? createDefaultDayLog() : createDefaultDayLog();
}

function getDailyScore(log: DayLog, profile: Profile) {
  let total = 0;
  let done = 0;

  if (profile.goals.includes("habit")) {
    total += 1;
    if (profile.lastRelapseDate !== localDateKey()) {
      done += 1;
    }
  }

  if (profile.goals.includes("spiritual")) {
    if (profile.religionPractice === "prayers") {
      const prayerKeys: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
      total += prayerKeys.length;
      done += prayerKeys.filter((key) => log.prayers[key]).length;
    } else {
      total += 1;
      done += log.spiritual ? 1 : 0;
    }
  }

  if (profile.goals.includes("exercise")) {
    total += 1;
    done += log.exerciseDone ? 1 : 0;
  }

  if (profile.goals.includes("reading")) {
    total += 1;
    done += log.reading ? 1 : 0;
  }

  if (profile.goals.includes("writing")) {
    total += 1;
    done += log.writing ? 1 : 0;
  }

  if (profile.goals.includes("water")) {
    total += 1;
    done += log.water >= 8 ? 1 : 0;
  }

  if (profile.goals.includes("sleep")) {
    total += 1;
    done += log.sleepDurationMin >= profile.sleepTargetHours * 60 ? 1 : 0;
  }

  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

function getLooksScore(log: DayLog) {
  const values = Object.values(log.looks);
  const done = values.filter(Boolean).length;
  return {
    done,
    total: values.length,
    percent: values.length === 0 ? 0 : Math.round((done / values.length) * 100),
  };
}

function getLastNDays(days: number, fromKey: string) {
  const results: string[] = [];
  const base = startOfDay(fromKey);
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(base);
    date.setDate(date.getDate() - index);
    results.push(localDateKey(date));
  }
  return results;
}

function buildOnboardingDraft(): OnboardingDraft {
  return {
    name: "",
    age: "18",
    weight: "",
    weightUnit: "kg",
    religion: "islam",
    religionPractice: "prayers",
    religionPracticeLabel: "Prayer checklist",
    goals: { ...DEFAULT_GOALS },
    habitName: "",
    pushupTarget: "20",
    careerGoal: "",
    futureSelf: "",
    savingsGoalName: "Gaming PC fund",
    savingsTarget: "0",
    savingsCurrent: "0",
    monthlyIncome: "0",
    monthlyExpenses: "0",
    currency: "USD",
  };
}

function getPracticeLabel(religion: Religion, practice: ReligionPractice) {
  if (practice === "prayers") return "Prayer checklist";
  if (practice === "scripture") return religion === "christianity" ? "Scripture" : "Scripture reading";
  if (practice === "puja") return "Puja";
  if (practice === "meditation") return "Meditation";
  return "Daily practice";
}

function getHabitStreak(profile: Profile) {
  return diffDays(localDateKey(), profile.lastRelapseDate);
}

function isPrayerPractice(profile: Profile) {
  return profile.religionPractice === "prayers";
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
        active ? "bg-[#E8A33D] text-[#0E1226] shadow-[0_0_0_1px_rgba(232,163,61,0.35)]" : "bg-white/5 text-[#8D93B8] hover:bg-white/10 hover:text-[#F3EEE2]",
      )}
    >
      {children}
    </button>
  );
}

function Surface({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-[1.75rem] border border-white/10 bg-[#171E3E]/95 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur", className)}>{children}</section>;
}

function StatPill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", accent ? "border-[#E8A33D]/30 bg-[#E8A33D]/10" : "border-white/10 bg-white/5")}>
      <div className="text-[11px] uppercase tracking-[0.24em] text-[#8D93B8]">{label}</div>
      <div className={cn("mt-1 text-sm font-semibold", accent ? "text-[#F8E9C8]" : "text-[#F3EEE2]")}>{value}</div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-2 text-sm text-[#F3EEE2]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-xs text-[#8D93B8]">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full rounded-2xl border border-white/10 bg-[#0E1226]/70 px-4 py-3 text-sm text-[#F3EEE2] outline-none transition placeholder:text-[#6E7398] focus:border-[#E8A33D]/40 focus:ring-2 focus:ring-[#E8A33D]/15", props.className)} />;
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("min-h-[96px] w-full rounded-2xl border border-white/10 bg-[#0E1226]/70 px-4 py-3 text-sm text-[#F3EEE2] outline-none transition placeholder:text-[#6E7398] focus:border-[#E8A33D]/40 focus:ring-2 focus:ring-[#E8A33D]/15", props.className)} />;
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("w-full rounded-2xl border border-white/10 bg-[#0E1226]/70 px-4 py-3 text-sm text-[#F3EEE2] outline-none transition focus:border-[#E8A33D]/40 focus:ring-2 focus:ring-[#E8A33D]/15", props.className)} />;
}

function ProgressArc({ percent, label, sublabel, size = 164 }: { percent: number; label: string; sublabel?: string; size?: number }) {
  const gradientId = useId().replace(/:/g, "");
  const radius = 66;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamp(percent, 0, 100) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(141,147,184,0.15)" strokeWidth={stroke} />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#E8A33D" />
            <stop offset="100%" stopColor="#4FB08A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display text-4xl font-semibold leading-none text-[#F3EEE2]">{percent}%</div>
        <div className="mt-2 max-w-[8rem] text-[10px] uppercase tracking-[0.32em] text-[#8D93B8]">{label}</div>
        {sublabel ? <div className="mt-1 text-[11px] text-[#8D93B8]">{sublabel}</div> : null}
      </div>
    </div>
  );
}

function Bars({ values, labels, color = "#E8A33D" }: { values: number[]; labels: string[]; color?: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="grid grid-cols-7 gap-2">
      {values.map((value, index) => (
        <div key={`${labels[index]}-${index}`} className="flex flex-col items-center gap-2">
          <div className="flex h-24 w-full items-end rounded-2xl bg-white/5 px-1 py-1">
            <div
              className="w-full rounded-xl transition-all duration-500"
              style={{ height: `${Math.max(8, (value / max) * 100)}%`, background: `linear-gradient(180deg, ${color}, rgba(232,163,61,0.18))` }}
            />
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#8D93B8]">{labels[index]}</div>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 py-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className={cn("w-full rounded-[2rem] border border-white/10 bg-[#171E3E] shadow-[0_30px_120px_rgba(0,0,0,0.5)]", wide ? "max-w-4xl" : "max-w-xl")}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#F3EEE2]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[#8D93B8]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#F3EEE2] transition hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="max-h-[82vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<LogsStore>({ checkins: [] });
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [showSettings, setShowSettings] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinText, setCheckinText] = useState("");
  const [checkinSource, setCheckinSource] = useState<"manual" | "notification">("manual");
  const [banner, setBanner] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => buildOnboardingDraft());
  const [customContribution, setCustomContribution] = useState("");
  const [openStages, setOpenStages] = useState<Record<string, boolean>>(
    ROADMAP.reduce<Record<string, boolean>>((acc, stage, index) => {
      acc[stage.key] = index === 0;
      return acc;
    }, {}),
  );
  const notificationStateRef = useRef<NotificationState>({ prayerSent: {}, lastRandomCheckinAt: null });

  const todayKey = localDateKey(clock);
  const currentTime = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;

  useEffect(() => {
    const savedProfile = normalizeProfile(safeParse(localStorage.getItem(STORAGE.profile), null));
    const savedLogs = normalizeLogs(safeParse(localStorage.getItem(STORAGE.logs), null));
    const savedNotificationState = createNotificationState(safeParse(localStorage.getItem(STORAGE.notificationState), null));

    notificationStateRef.current = savedNotificationState;
    setProfile(savedProfile);
    setLogs(savedLogs);
    setNotificationPermission(typeof Notification === "undefined" ? "default" : Notification.permission);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !profile) return;
    localStorage.setItem(STORAGE.profile, JSON.stringify(profile));
  }, [profile, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE.logs, JSON.stringify(logs));
  }, [logs, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE.notificationState, JSON.stringify(notificationStateRef.current));
  }, [ready]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile) return;
    setLogs((prev) => {
      if (prev[todayKey] && !Array.isArray(prev[todayKey])) return prev;
      return {
        ...prev,
        [todayKey]: createDefaultDayLog(),
      };
    });
  }, [profile, todayKey]);

  useEffect(() => {
    if (!profile) return;
    if (new URLSearchParams(window.location.search).get("checkin") !== "1") return;
    setActiveTab("home");
    setCheckinSource("notification");
    setCheckinText("");
    setShowCheckinModal(true);
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  }, [profile]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "notification-click" && event.data.payload?.kind === "checkin") {
        setActiveTab("home");
        setCheckinSource("notification");
        setCheckinText(event.data.payload.prompt ?? "");
        setShowCheckinModal(true);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!profile || typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const nowMinute = currentTime;
    const sentToday = notificationStateRef.current.prayerSent[todayKey] ?? [];
    const updatedSent = [...sentToday];
    let changed = false;

    (Object.entries(profile.prayerTimes) as Array<[CapitalizedPrayerKey, string]>).forEach(([label, time]) => {
      if (time === nowMinute && !updatedSent.includes(label)) {
        changed = true;
        updatedSent.push(label);
        sendBrowserNotification(`Prayer reminder`, `${label} is due now.`, {
          kind: "prayer",
          prayer: label,
          date: todayKey,
        });
      }
    });

    if (changed) {
      notificationStateRef.current = {
        ...notificationStateRef.current,
        prayerSent: {
          ...notificationStateRef.current.prayerSent,
          [todayKey]: updatedSent,
        },
      };
      localStorage.setItem(STORAGE.notificationState, JSON.stringify(notificationStateRef.current));
    }
  }, [clock, currentTime, profile, todayKey]);

  useEffect(() => {
    if (!profile?.checkinEnabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;

    let timeoutId: number | undefined;
    const schedule = () => {
      const delay = (60 + Math.floor(Math.random() * 121)) * 60 * 1000;
      timeoutId = window.setTimeout(() => {
        sendBrowserNotification("Nexreaper Ledger", "What are you doing right now?", {
          kind: "checkin",
          prompt: "What are you doing right now?",
          source: "random",
        }).then((sent) => {
          if (sent) {
            notificationStateRef.current = {
              ...notificationStateRef.current,
              lastRandomCheckinAt: new Date().toISOString(),
            };
            localStorage.setItem(STORAGE.notificationState, JSON.stringify(notificationStateRef.current));
          }
          schedule();
        });
      }, delay);
    };

    schedule();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [profile?.checkinEnabled, notificationPermission]);

  const todayLog = profile ? getDayLog(logs, todayKey, profile) : createDefaultDayLog();
  const weeklyDays = useMemo(() => getLastNDays(7, todayKey), [todayKey]);
  const weeklyScores = useMemo(
    () => weeklyDays.map((dateKey) => (profile ? getDailyScore(getDayLog(logs, dateKey, profile), profile).percent : 0)),
    [logs, profile, weeklyDays],
  );
  const looksScores = useMemo(
    () => weeklyDays.map((dateKey) => getLooksScore(getDayLog(logs, dateKey, profile)).percent),
    [logs, profile, weeklyDays],
  );
  const sleepHistory = useMemo(() => [...(profile?.sleepSessions ?? [])].slice(-7).reverse(), [profile?.sleepSessions]);
  const dailyScore = profile ? getDailyScore(todayLog, profile) : { done: 0, total: 0, percent: 0 };
  const looksScore = getLooksScore(todayLog);
  const streak = profile ? getHabitStreak(profile) : 0;
  const monthlyBudget = profile ? Math.max(profile.monthlyIncome - profile.monthlyExpenses, 0) : 0;
  const savingsRemaining = profile ? Math.max(profile.savingsTarget - profile.savingsCurrent, 0) : 0;
  const monthsToGoal = profile && monthlyBudget > 0 && savingsRemaining > 0 ? savingsRemaining / monthlyBudget : null;
  const checkins = [...(logs.checkins ?? [])].slice(-5).reverse();
  const prayerKeys: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  async function sendBrowserNotification(title: string, body: string, data: Record<string, unknown>) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;

    try {
      const options = { body, tag: String(data.kind ?? title), data };
      const registration = await navigator.serviceWorker?.ready;
      if (registration && "showNotification" in registration) {
        await registration.showNotification(title, options);
      } else {
        const notification = new Notification(title, options);
        notification.onclick = () => {
          window.focus();
          if (data.kind === "checkin") {
            setActiveTab("home");
            setCheckinSource("notification");
            setCheckinText(String(data.prompt ?? ""));
            setShowCheckinModal(true);
          }
        };
      }
      return true;
    } catch {
      return false;
    }
  }

  function updateProfile(updater: (current: Profile) => Profile) {
    setProfile((current) => (current ? updater(current) : current));
  }

  function updateTodayLog(updater: (current: DayLog) => DayLog) {
    if (!profile) return;
    setLogs((current) => {
      const nextCurrent = getDayLog(current, todayKey, profile);
      const nextLog = updater(nextCurrent);
      return {
        ...current,
        [todayKey]: nextLog,
      };
    });
  }

  function requestNotificationPermission() {
    if (typeof Notification === "undefined") {
      setBanner("Notifications are not supported in this browser.");
      return Promise.resolve(false);
    }

    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      return Promise.resolve(true);
    }

    return Notification.requestPermission().then((permission) => {
      setNotificationPermission(permission);
      if (permission === "granted") {
        setBanner("Notifications enabled for prayer reminders and check-ins.");
        return true;
      }
      setBanner("Notifications were not enabled.");
      return false;
    });
  }

  async function handleTestNotification() {
    const granted = await requestNotificationPermission();
    if (!granted) {
      window.alert("Please allow notifications in your browser settings to receive reminders.");
      return;
    }

    const sent = await sendBrowserNotification("Nexreaper Ledger", "This is a test reminder from your ledger.", { kind: "test" });
    if (sent) {
      setBanner("Test notification sent.");
    } else {
      window.alert("Test notification could not be shown. Check browser notification permissions.");
    }
  }

  function togglePrayer(key: PrayerKey) {
    updateTodayLog((current) => ({
      ...current,
      prayers: { ...current.prayers, [key]: !current.prayers[key] },
    }));
  }

  function toggleExercise(delta: number) {
    updateTodayLog((current) => {
      const exerciseCount = Math.max(0, current.exerciseCount + delta);
      return {
        ...current,
        exerciseCount,
        exerciseDone: exerciseCount >= (profile?.pushupTarget ?? 20),
      };
    });
  }

  function toggleWater(index: number) {
    updateTodayLog((current) => ({
      ...current,
      water: clamp(index + 1, 0, 8),
    }));
  }

  function setWaterCount(count: number) {
    updateTodayLog((current) => ({
      ...current,
      water: clamp(count, 0, 8),
    }));
  }

  function toggleDailyField(field: "reading" | "writing" | "spiritual") {
    updateTodayLog((current) => ({
      ...current,
      [field]: !current[field],
    }));
  }

  function toggleLooksTask(task: LookTaskKey) {
    updateTodayLog((current) => ({
      ...current,
      looks: { ...current.looks, [task]: !current.looks[task] },
    }));
  }

  function resetHabitStreak() {
    if (!profile) return;
    const today = localDateKey();
    updateProfile((current) => ({
      ...current,
      lastRelapseDate: today,
      habitStartDate: today,
    }));
    setBanner(`Habit streak reset for ${profile.habitName}.`);
  }

  function addSavingsContribution(amount: number) {
    if (!profile || amount <= 0) return;
    const safeAmount = Math.min(amount, Math.max(profile.savingsTarget - profile.savingsCurrent, 0));
    if (safeAmount <= 0) return;
    updateProfile((current) => {
      const currentMonth = monthKey();
      return {
        ...current,
        savingsCurrent: current.savingsCurrent + safeAmount,
        savingsLog: {
          ...current.savingsLog,
          [currentMonth]: (current.savingsLog[currentMonth] ?? 0) + safeAmount,
        },
      };
    });
    setBanner(`Added ${formatCurrency(safeAmount, profile.currency)} toward ${profile.savingsGoalName}.`);
  }

  function addCustomContribution() {
    const amount = Number(customContribution);
    if (!Number.isFinite(amount) || amount <= 0) return;
    addSavingsContribution(amount);
    setCustomContribution("");
  }

  function toggleRoadmapStep(stepKey: string) {
    updateProfile((current) => ({
      ...current,
      roadmapProgress: {
        ...current.roadmapProgress,
        [stepKey]: !current.roadmapProgress[stepKey],
      },
    }));
  }

  function startSleep() {
    if (!profile || profile.sleepStatus === "asleep") return;
    updateProfile((current) => ({
      ...current,
      sleepStatus: "asleep",
      sleepStartedAt: new Date().toISOString(),
    }));
    updateTodayLog((current) => ({
      ...current,
      sleep: false,
      sleepDurationMin: current.sleepDurationMin,
    }));
    setBanner("Sleep timer started.");
  }

  function stopSleep() {
    if (!profile || profile.sleepStatus !== "asleep" || !profile.sleepStartedAt) return;
    const start = new Date(profile.sleepStartedAt);
    const end = new Date();
    const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
    const session: SleepSession = {
      start: start.toISOString(),
      end: end.toISOString(),
      durationMin,
      date: localDateKey(end),
    };

    updateProfile((current) => ({
      ...current,
      sleepStatus: "awake",
      sleepStartedAt: null,
      sleepSessions: [...current.sleepSessions, session],
    }));

    updateTodayLog((current) => ({
      ...current,
      sleep: true,
      sleepDurationMin: durationMin,
    }));
    setBanner(`Sleep session saved: ${formatDuration(durationMin)}.`);
  }

  function submitCheckin() {
    const text = checkinText.trim();
    if (!text) return;
    setLogs((current) => ({
      ...current,
      checkins: [...(current.checkins ?? []), { timestamp: new Date().toISOString(), text, source: checkinSource }],
    }));
    setCheckinText("");
    setShowCheckinModal(false);
    setBanner("Activity logged.");
  }

  function finishOnboarding() {
    const nextProfile = createInitialProfile(draft);
    const nextLogs = {
      ...logs,
      [localDateKey()]: createDefaultDayLog(),
      checkins: logs.checkins ?? [],
    };
    setProfile(nextProfile);
    setLogs(nextLogs);
    setActiveTab("home");
    setBanner("Profile created and local storage initialized.");
  }

  function updateDraftGoal(key: GoalKey) {
    setDraft((current) => ({
      ...current,
      goals: { ...current.goals, [key]: !current.goals[key] },
    }));
  }

  function updateDraftReligion(religion: Religion) {
    const defaultPractice: ReligionPractice = religion === "islam" ? "prayers" : religion === "christianity" ? "scripture" : religion === "hinduism" ? "puja" : "meditation";
    setDraft((current) => ({
      ...current,
      religion,
      religionPractice: defaultPractice,
      religionPracticeLabel: getPracticeLabel(religion, defaultPractice),
    }));
  }

  function updateDraftPractice(practice: ReligionPractice) {
    setDraft((current) => ({
      ...current,
      religionPractice: practice,
      religionPracticeLabel: getPracticeLabel(current.religion, practice),
    }));
  }

  const savingBudgetDisabled = monthlyBudget <= 0 || savingsRemaining <= 0;
  const sleepProgress = profile ? clamp((profile.sleepTargetHours * 60 === 0 ? 0 : todayLog.sleepDurationMin / (profile.sleepTargetHours * 60)) * 100, 0, 100) : 0;
  const looksProgress = looksScore.percent;
  const totalLookScore = average(looksScores);

  const onboardingContent = [
    {
      title: "Welcome",
      body: (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[#8D93B8]">
            Nexreaper Ledger keeps your habits, prayers, sleep, savings, and career momentum on one phone screen, fully stored on your device.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatPill label="Offline" value="Local only" accent />
            <StatPill label="Focus" value="Mobile first" />
            <StatPill label="Reminders" value="Prayer + check-ins" />
          </div>
        </div>
      ),
    },
    {
      title: "About You",
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <TextInput value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ahmad" />
          </Field>
          <Field label="Age">
            <TextInput value={draft.age} onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value }))} inputMode="numeric" />
          </Field>
          <Field label="Weight">
            <TextInput value={draft.weight} onChange={(event) => setDraft((current) => ({ ...current, weight: event.target.value }))} inputMode="decimal" />
          </Field>
          <Field label="Unit">
            <Select value={draft.weightUnit} onChange={(event) => setDraft((current) => ({ ...current, weightUnit: event.target.value as WeightUnit }))}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </Select>
          </Field>
        </div>
      ),
    },
    {
      title: "Beliefs",
      body: (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Religion">
              <Select value={draft.religion} onChange={(event) => updateDraftReligion(event.target.value as Religion)}>
                <option value="islam">Islam</option>
                <option value="christianity">Christianity</option>
                <option value="hinduism">Hinduism</option>
                <option value="buddhism">Buddhism</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Practice">
              <Select value={draft.religionPractice ?? "meditation"} onChange={(event) => updateDraftPractice(event.target.value as ReligionPractice)}>
                <option value="prayers">Prayers</option>
                <option value="scripture">Scripture</option>
                <option value="puja">Puja</option>
                <option value="meditation">Meditation</option>
              </Select>
            </Field>
          </div>
          <Field label="Practice label" hint="Shown on the dashboard">
            <TextInput value={draft.religionPracticeLabel} onChange={(event) => setDraft((current) => ({ ...current, religionPracticeLabel: event.target.value }))} placeholder="Prayer checklist" />
          </Field>
        </div>
      ),
    },
    {
      title: "Goals",
      body: (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {GOAL_KEYS.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => updateDraftGoal(goal)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left text-sm transition",
                  draft.goals[goal] ? "border-[#E8A33D]/35 bg-[#E8A33D]/10 text-[#F8E9C8]" : "border-white/10 bg-white/5 text-[#F3EEE2] hover:bg-white/8",
                )}
              >
                {goal.charAt(0).toUpperCase() + goal.slice(1)}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Habit name">
              <TextInput value={draft.habitName} onChange={(event) => setDraft((current) => ({ ...current, habitName: event.target.value }))} placeholder="No relapse habit" />
            </Field>
            <Field label="Push-up target">
              <TextInput value={draft.pushupTarget} onChange={(event) => setDraft((current) => ({ ...current, pushupTarget: event.target.value }))} inputMode="numeric" />
            </Field>
            <Field label="Savings goal name">
              <TextInput value={draft.savingsGoalName} onChange={(event) => setDraft((current) => ({ ...current, savingsGoalName: event.target.value }))} placeholder="Gaming PC fund" />
            </Field>
            <Field label="Savings target">
              <TextInput value={draft.savingsTarget} onChange={(event) => setDraft((current) => ({ ...current, savingsTarget: event.target.value }))} inputMode="decimal" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current savings">
              <TextInput value={draft.savingsCurrent} onChange={(event) => setDraft((current) => ({ ...current, savingsCurrent: event.target.value }))} inputMode="decimal" />
            </Field>
            <Field label="Monthly income">
              <TextInput value={draft.monthlyIncome} onChange={(event) => setDraft((current) => ({ ...current, monthlyIncome: event.target.value }))} inputMode="decimal" />
            </Field>
            <Field label="Monthly expenses">
              <TextInput value={draft.monthlyExpenses} onChange={(event) => setDraft((current) => ({ ...current, monthlyExpenses: event.target.value }))} inputMode="decimal" />
            </Field>
          </div>
          <Field label="Currency">
            <TextInput value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))} placeholder="USD" />
          </Field>
        </div>
      ),
    },
    {
      title: "Future Self",
      body: (
        <div className="space-y-4">
          <Field label="Career goal">
            <TextArea value={draft.careerGoal} onChange={(event) => setDraft((current) => ({ ...current, careerGoal: event.target.value }))} placeholder="Become a senior React developer." />
          </Field>
          <Field label="Future self note" hint="A short line for motivation">
            <TextArea value={draft.futureSelf} onChange={(event) => setDraft((current) => ({ ...current, futureSelf: event.target.value }))} placeholder="I stay disciplined even when no one is watching." />
          </Field>
        </div>
      ),
    },
  ];

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-[#F3EEE2]">
        <div className="space-y-3">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-[#E8A33D]/30 bg-[#E8A33D]/10" />
          <p className="font-display text-2xl">Loading Nexreaper Ledger</p>
          <p className="text-sm text-[#8D93B8]">Restoring your local profile and daily logs.</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex-1 rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(232,163,61,0.14),_transparent_38%),linear-gradient(180deg,rgba(23,30,62,0.98),rgba(14,18,38,1))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.3em] text-[#E8A33D]">Nexreaper Ledger</p>
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[#F3EEE2] sm:text-5xl">
                One ledger for your discipline.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#8D93B8]">
                Track habits, prayers, sleep, savings, and career momentum in a single offline-friendly dashboard made for Android phones.
              </p>
            </div>
            <div className="hidden sm:block">
              <ProgressArc percent={100} label="Start here" sublabel="Complete setup" size={150} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setOnboardingStep((current) => Math.min(current + 1, onboardingContent.length - 1))}
              className="rounded-full bg-[#E8A33D] px-5 py-3 text-sm font-semibold text-[#0E1226] transition hover:opacity-90"
            >
              Begin onboarding
            </button>
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[#F3EEE2] transition hover:bg-white/10"
            >
              Enable notifications
            </button>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Surface className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Setup</div>
                  <h2 className="mt-2 font-display text-2xl text-[#F3EEE2]">{onboardingContent[onboardingStep].title}</h2>
                </div>
                <div className="text-right text-xs text-[#8D93B8]">
                  <div>
                    Step {onboardingStep + 1} of {onboardingContent.length}
                  </div>
                  <div className="mt-2 h-2 w-24 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#E8A33D]" style={{ width: `${((onboardingStep + 1) / onboardingContent.length) * 100}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-5">{onboardingContent[onboardingStep].body}</div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setOnboardingStep((current) => Math.max(0, current - 1))}
                  disabled={onboardingStep === 0}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[#F3EEE2] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>
                {onboardingStep < onboardingContent.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setOnboardingStep((current) => Math.min(onboardingContent.length - 1, current + 1))}
                    className="rounded-full bg-[#E8A33D] px-5 py-3 text-sm font-semibold text-[#0E1226] transition hover:opacity-90"
                  >
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={finishOnboarding} className="rounded-full bg-[#4FB08A] px-5 py-3 text-sm font-semibold text-[#0E1226] transition hover:opacity-90">
                    Create ledger
                  </button>
                )}
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">What you get</div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#F3EEE2]">
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Daily tracking for habits, sleep, water, reading, writing, exercise, and spiritual practice.</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Prayer reminders and random check-ins with browser notifications.</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Savings and career progress saved instantly in localStorage.</li>
              </ul>
            </Surface>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-6 pt-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <header className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(232,163,61,0.13),_transparent_36%),linear-gradient(180deg,rgba(23,30,62,0.97),rgba(14,18,38,1))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4 lg:max-w-[18rem]">
              <div>
                <p className="font-display text-sm uppercase tracking-[0.3em] text-[#E8A33D]">Nexreaper Ledger</p>
                <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[#F3EEE2] sm:text-5xl">{profile.name || "Ledger"}</h1>
                <p className="mt-3 text-sm leading-6 text-[#8D93B8]">
                  Your daily discipline, prayers, sleep, savings, and career path in one offline workspace.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {notificationPermission !== "granted" ? (
                  <button type="button" onClick={requestNotificationPermission} className="rounded-full bg-[#E8A33D] px-4 py-3 text-sm font-semibold text-[#0E1226] transition hover:opacity-90">
                    Enable reminders
                  </button>
                ) : (
                  <div className="rounded-full border border-[#4FB08A]/30 bg-[#4FB08A]/10 px-4 py-3 text-sm font-medium text-[#C8F0E2]">Notifications enabled</div>
                )}
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-[#F3EEE2] transition hover:bg-white/10"
                >
                  Settings
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-end">
              <ProgressArc percent={dailyScore.percent} label="Today" sublabel={`${dailyScore.done}/${dailyScore.total} actions`} size={188} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatPill label="Habit streak" value={`${streak} days`} accent />
            <StatPill label="Sleep" value={profile.sleepStatus === "asleep" && profile.sleepStartedAt ? `Sleeping ${formatDuration((clock.getTime() - new Date(profile.sleepStartedAt).getTime()) / 60000)}` : `${profile.sleepTargetHours}h target`} />
            <StatPill label="Water" value={`${todayLog.water}/8 glasses`} />
          </div>
        </header>

        {banner ? (
          <div className="rounded-2xl border border-[#E8A33D]/20 bg-[#E8A33D]/10 px-4 py-3 text-sm text-[#F8E9C8] transition-all duration-300">
            {banner}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <TabButton active={activeTab === "home"} onClick={() => setActiveTab("home")}>
            Home
          </TabButton>
          <TabButton active={activeTab === "sleep"} onClick={() => setActiveTab("sleep")}>
            Sleep
          </TabButton>
          <TabButton active={activeTab === "looks"} onClick={() => setActiveTab("looks")}>
            Looksmaxing
          </TabButton>
        </div>

        {activeTab === "home" ? (
          <div className="space-y-4">
            <Surface className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Daily arc</div>
                  <h2 className="mt-2 font-display text-2xl text-[#F3EEE2]">Sunrise progress</h2>
                  <p className="mt-2 text-sm text-[#8D93B8]">A single glance shows how much of today is already complete.</p>
                </div>
                <div className="hidden sm:block">
                  <ProgressArc percent={dailyScore.percent} label="Completion" sublabel="All active goals" size={132} />
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-[#E8A33D] to-[#4FB08A] transition-all duration-700" style={{ width: `${dailyScore.percent}%` }} />
              </div>
            </Surface>

            <div className="grid gap-4 sm:grid-cols-2">
              <Surface className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Habit streak</div>
                    <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">{profile.habitName}</h3>
                  </div>
                  <button type="button" onClick={resetHabitStreak} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#F3EEE2] transition hover:bg-white/10">
                    Reset
                  </button>
                </div>
                <div className="mt-4 text-3xl font-semibold text-[#E8A33D]">{streak} days</div>
                <p className="mt-2 text-sm text-[#8D93B8]">Last relapse: {formatDateLabel(profile.lastRelapseDate)}</p>
              </Surface>

              <Surface className="p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Weekly completion</div>
                <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">Last 7 days</h3>
                <div className="mt-5">
                  <Bars values={weeklyScores} labels={weeklyDays.map(formatDateLabel)} />
                </div>
              </Surface>
            </div>

            <Surface className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Spiritual practice</div>
                  <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">{profile.religionPracticeLabel}</h3>
                </div>
                <div className="text-sm text-[#8D93B8]">
                  {isPrayerPractice(profile) ? "5 daily prayers" : "Single practice toggle"}
                </div>
              </div>

              {isPrayerPractice(profile) ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {prayerKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePrayer(key)}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left text-sm transition duration-200",
                        todayLog.prayers[key] ? "border-[#4FB08A]/30 bg-[#4FB08A]/10 text-[#C8F0E2]" : "border-white/10 bg-white/5 text-[#F3EEE2] hover:bg-white/10",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{key}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-[#8D93B8]">{todayLog.prayers[key] ? "Done" : "Pending"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleDailyField("spiritual")}
                  className={cn(
                    "mt-4 w-full rounded-2xl border px-4 py-4 text-left text-sm transition",
                    todayLog.spiritual ? "border-[#4FB08A]/30 bg-[#4FB08A]/10 text-[#C8F0E2]" : "border-white/10 bg-white/5 text-[#F3EEE2] hover:bg-white/10",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{profile.religionPracticeLabel}</span>
                    <span>{todayLog.spiritual ? "Complete" : "Toggle"}</span>
                  </div>
                </button>
              )}
            </Surface>

            <Surface className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Exercise</div>
                  <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">Push-ups</h3>
                </div>
                <div className="text-right text-sm text-[#8D93B8]">
                  <div>{todayLog.exerciseCount}/{profile.pushupTarget}</div>
                  <div className="mt-1 text-[#4FB08A]">{todayLog.exerciseDone ? "Target reached" : "Keep going"}</div>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-[#4FB08A] transition-all duration-500" style={{ width: `${clamp((todayLog.exerciseCount / Math.max(1, profile.pushupTarget)) * 100, 0, 100)}%` }} />
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => toggleExercise(-1)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-[#F3EEE2] transition hover:bg-white/10">
                  -1
                </button>
                <button type="button" onClick={() => toggleExercise(1)} className="flex-1 rounded-2xl border border-[#4FB08A]/25 bg-[#4FB08A]/10 px-4 py-3 text-sm font-semibold text-[#C8F0E2] transition hover:bg-[#4FB08A]/15">
                  +1
                </button>
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Daily practice</div>
              <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">Reading, writing, sleep, water</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => toggleDailyField("reading")}
                  className={cn("rounded-2xl border px-4 py-4 text-left text-sm transition", todayLog.reading ? "border-[#4FB08A]/30 bg-[#4FB08A]/10 text-[#C8F0E2]" : "border-white/10 bg-white/5 text-[#F3EEE2] hover:bg-white/10")}
                >
                  <div className="flex items-center justify-between">
                    <span>Reading</span>
                    <span>{todayLog.reading ? "Done" : "Tap"}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => toggleDailyField("writing")}
                  className={cn("rounded-2xl border px-4 py-4 text-left text-sm transition", todayLog.writing ? "border-[#4FB08A]/30 bg-[#4FB08A]/10 text-[#C8F0E2]" : "border-white/10 bg-white/5 text-[#F3EEE2] hover:bg-white/10")}
                >
                  <div className="flex items-center justify-between">
                    <span>Writing</span>
                    <span>{todayLog.writing ? "Done" : "Tap"}</span>
                  </div>
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-[#F3EEE2]">
                  <span>Water glasses</span>
                  <span className="text-[#8D93B8]">{todayLog.water}/8</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Array.from({ length: 8 }).map((_, index) => {
                    const filled = todayLog.water > index;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleWater(index)}
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl border text-xs font-semibold transition-all duration-200",
                          filled ? "border-[#4FB08A]/30 bg-[#4FB08A]/10 text-[#C8F0E2]" : "border-white/10 bg-[#0E1226]/70 text-[#8D93B8] hover:bg-white/10",
                        )}
                        aria-label={`Water glass ${index + 1}`}
                        aria-pressed={filled}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button type="button" onClick={() => setWaterCount(Math.max(0, todayLog.water - 1))} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-[#F3EEE2] transition hover:bg-white/10">
                    -1 glass
                  </button>
                  <button type="button" onClick={() => setWaterCount(8)} className="rounded-full border border-[#E8A33D]/25 bg-[#E8A33D]/10 px-4 py-2 text-xs font-semibold text-[#F8E9C8] transition hover:bg-[#E8A33D]/15">
                    Fill all
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#8D93B8]">
                Sleep summary: {todayLog.sleepDurationMin > 0 ? `${formatDuration(todayLog.sleepDurationMin)} logged today` : profile.sleepStatus === "asleep" ? "Timer running" : "No sleep log yet"}
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Savings</div>
                  <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">{profile.savingsGoalName}</h3>
                </div>
                <div className="text-sm text-[#8D93B8]">{formatCurrency(profile.savingsCurrent, profile.currency)} / {formatCurrency(profile.savingsTarget, profile.currency)}</div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#F3EEE2]">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Monthly budget</span>
                  <span className={monthlyBudget > 0 ? "text-[#4FB08A]" : "text-[#E0654B]"}>{formatCurrency(monthlyBudget, profile.currency)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Time to goal</span>
                  <span>{monthsToGoal ? `${monthsToGoal.toFixed(1)} months` : "No surplus budget"}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => addSavingsContribution(monthlyBudget)}
                  disabled={savingBudgetDisabled}
                  className="rounded-2xl border border-[#4FB08A]/25 bg-[#4FB08A]/10 px-4 py-3 text-sm font-semibold text-[#C8F0E2] transition hover:bg-[#4FB08A]/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add budgeted
                </button>
                <div className="flex flex-1 gap-3">
                  <TextInput value={customContribution} onChange={(event) => setCustomContribution(event.target.value)} inputMode="decimal" placeholder="Custom amount" className="flex-1" />
                  <button type="button" onClick={addCustomContribution} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-[#F3EEE2] transition hover:bg-white/10">
                    Add
                  </button>
                </div>
              </div>
              <div className="mt-3 text-xs text-[#8D93B8]">
                This button is disabled when monthly income minus expenses is zero or negative.
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Career roadmap</div>
                  <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">{profile.careerGoal}</h3>
                </div>
                <div className="text-sm text-[#8D93B8]">
                  {Object.values(profile.roadmapProgress).filter(Boolean).length}/{Object.keys(profile.roadmapProgress).length} done
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {ROADMAP.map((stage) => {
                  const stepCount = stage.steps.length;
                  const doneCount = stage.steps.filter((step) => profile.roadmapProgress[step.key]).length;
                  const open = openStages[stage.key];
                  return (
                    <div key={stage.key} className="rounded-2xl border border-white/10 bg-white/5">
                      <button
                        type="button"
                        onClick={() => setOpenStages((current) => ({ ...current, [stage.key]: !current[stage.key] }))}
                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                      >
                        <div>
                          <div className="text-sm font-semibold text-[#F3EEE2]">{stage.stage}</div>
                          <div className="text-xs text-[#8D93B8]">{doneCount}/{stepCount} completed</div>
                        </div>
                        <div className={cn("text-[#E8A33D] transition-transform duration-200", open ? "rotate-180" : "rotate-0")}>⌄</div>
                      </button>
                      {open ? (
                        <div className="space-y-2 border-t border-white/10 px-4 py-4">
                          {stage.steps.map((step) => (
                            <label key={step.key} className="flex cursor-pointer items-start gap-3 rounded-2xl px-2 py-2 text-sm text-[#F3EEE2] transition hover:bg-white/5">
                              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#E8A33D]" checked={Boolean(profile.roadmapProgress[step.key])} onChange={() => toggleRoadmapStep(step.key)} />
                              <span className="leading-6">{step.label}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Check-ins</div>
                  <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">Last 5 activities</h3>
                </div>
                <button type="button" onClick={() => { setCheckinSource("manual"); setCheckinText(""); setShowCheckinModal(true); }} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-[#F3EEE2] transition hover:bg-white/10">
                  Manual add
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {checkins.length ? (
                  checkins.map((entry) => (
                    <div key={entry.timestamp} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#8D93B8]">{formatDateTime(entry.timestamp)}</div>
                      <div className="mt-1 text-sm text-[#F3EEE2]">{entry.text}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-[#8D93B8]">No check-ins yet. Add one manually or wait for a reminder.</div>
                )}
              </div>
            </Surface>
          </div>
        ) : null}

        {activeTab === "sleep" ? (
          <div className="space-y-4">
            <Surface className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Sleep timer</div>
                  <h2 className="mt-2 font-display text-2xl text-[#F3EEE2]">Track your nights</h2>
                </div>
                <div className="text-right text-sm text-[#8D93B8]">
                  <div>{profile.sleepStatus === "asleep" && profile.sleepStartedAt ? `Elapsed ${formatDuration((clock.getTime() - new Date(profile.sleepStartedAt).getTime()) / 60000)}` : "Ready to sleep"}</div>
                  <div className="mt-1 text-[#E8A33D]">Target {profile.sleepTargetHours}h</div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={startSleep} disabled={profile.sleepStatus === "asleep"} className="flex-1 rounded-2xl bg-[#E8A33D] px-4 py-4 text-sm font-semibold text-[#0E1226] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  I&apos;m Going to Sleep
                </button>
                <button type="button" onClick={stopSleep} disabled={profile.sleepStatus !== "asleep"} className="flex-1 rounded-2xl border border-[#4FB08A]/25 bg-[#4FB08A]/10 px-4 py-4 text-sm font-semibold text-[#C8F0E2] transition hover:bg-[#4FB08A]/15 disabled:cursor-not-allowed disabled:opacity-40">
                  I Just Woke Up
                </button>
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Sleep target</div>
                  <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">Adjust nightly target</h3>
                </div>
                <div className="text-sm text-[#8D93B8]">{profile.sleepTargetHours.toFixed(1)} hours</div>
              </div>
              <div className="mt-4 space-y-3">
                <input
                  type="range"
                  min="4"
                  max="12"
                  step="0.5"
                  value={profile.sleepTargetHours}
                  onChange={(event) => updateProfile((current) => ({ ...current, sleepTargetHours: Number(event.target.value) }))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#E8A33D]"
                />
                <div className="flex items-center justify-between text-xs text-[#8D93B8]">
                  <span>4h</span>
                  <span>12h</span>
                </div>
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Last 7 nights</div>
                  <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">Sleep duration chart</h3>
                </div>
                <div className="text-sm text-[#8D93B8]">Goal completion {Math.round(sleepProgress)}%</div>
              </div>
              <div className="mt-5">
                <Bars values={sleepHistory.map((session) => session.durationMin)} labels={sleepHistory.map((session) => formatDateLabel(session.date))} color="#4FB08A" />
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">History</div>
              <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">Recent sessions</h3>
              <div className="mt-4 space-y-3">
                {sleepHistory.length ? (
                  sleepHistory.map((session) => (
                    <div key={session.start} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#F3EEE2]">
                      <div className="flex items-center justify-between gap-4">
                        <span>{formatDateTime(session.start)}</span>
                        <span className="text-[#4FB08A]">{formatDuration(session.durationMin)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-[#8D93B8]">No sleep sessions saved yet.</div>
                )}
              </div>
            </Surface>
          </div>
        ) : null}

        {activeTab === "looks" ? (
          <div className="space-y-4">
            <Surface className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Looksmaxing</div>
                  <h2 className="mt-2 font-display text-2xl text-[#F3EEE2]">Daily appearance routine</h2>
                </div>
                <ProgressArc percent={looksProgress} label="Looks" sublabel={`${looksScore.done}/${looksScore.total} complete`} size={140} />
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-[#E8A33D] to-[#4FB08A] transition-all duration-700" style={{ width: `${looksProgress}%` }} />
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Checklist</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {LOOK_TASKS.map((task) => (
                  <button
                    key={task.key}
                    type="button"
                    onClick={() => toggleLooksTask(task.key)}
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left text-sm transition",
                      todayLog.looks[task.key] ? "border-[#4FB08A]/30 bg-[#4FB08A]/10 text-[#C8F0E2]" : "border-white/10 bg-white/5 text-[#F3EEE2] hover:bg-white/10",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{task.label}</span>
                      <span className="text-xs uppercase tracking-[0.2em] text-[#8D93B8]">{todayLog.looks[task.key] ? "Done" : "Tap"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Weekly trend</div>
                  <h3 className="mt-2 font-display text-xl text-[#F3EEE2]">Last 7 days</h3>
                </div>
                <div className="text-sm text-[#8D93B8]">Average {Math.round(totalLookScore)}%</div>
              </div>
              <div className="mt-5">
                <Bars values={looksScores} labels={weeklyDays.map(formatDateLabel)} color="#E0654B" />
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Tips</div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#F3EEE2]">
                {STATIC_LOOKS_TIPS.map((tip) => (
                  <li key={tip} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">{tip}</li>
                ))}
              </ul>
            </Surface>
          </div>
        ) : null}
      </div>

      {showSettings && profile ? (
        <Modal title="Settings" description="Edit profile, savings, and prayer times. Changes save immediately." wide onClose={() => setShowSettings(false)}>
          <div className="space-y-6">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Profile</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <TextInput value={profile.name} onChange={(event) => updateProfile((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label="Age">
                  <TextInput value={String(profile.age)} onChange={(event) => updateProfile((current) => ({ ...current, age: Number(event.target.value) || 0 }))} inputMode="numeric" />
                </Field>
                <Field label="Weight">
                  <TextInput value={String(profile.weight)} onChange={(event) => updateProfile((current) => ({ ...current, weight: Number(event.target.value) || 0 }))} inputMode="decimal" />
                </Field>
                <Field label="Weight unit">
                  <Select value={profile.weightUnit} onChange={(event) => updateProfile((current) => ({ ...current, weightUnit: event.target.value as WeightUnit }))}>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </Select>
                </Field>
                <Field label="Push-up target">
                  <TextInput value={String(profile.pushupTarget)} onChange={(event) => updateProfile((current) => ({ ...current, pushupTarget: Math.max(1, Number(event.target.value) || 0) }))} inputMode="numeric" />
                </Field>
                <Field label="Habit name">
                  <TextInput value={profile.habitName} onChange={(event) => updateProfile((current) => ({ ...current, habitName: event.target.value }))} />
                </Field>
                <Field label="Career goal">
                  <TextArea value={profile.careerGoal} onChange={(event) => updateProfile((current) => ({ ...current, careerGoal: event.target.value }))} />
                </Field>
                <Field label="Future self note">
                  <TextArea value={profile.futureSelf} onChange={(event) => updateProfile((current) => ({ ...current, futureSelf: event.target.value }))} />
                </Field>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Savings</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Goal name">
                  <TextInput value={profile.savingsGoalName} onChange={(event) => updateProfile((current) => ({ ...current, savingsGoalName: event.target.value }))} />
                </Field>
                <Field label="Target">
                  <TextInput value={String(profile.savingsTarget)} onChange={(event) => updateProfile((current) => ({ ...current, savingsTarget: Math.max(0, Number(event.target.value) || 0) }))} inputMode="decimal" />
                </Field>
                <Field label="Current">
                  <TextInput value={String(profile.savingsCurrent)} onChange={(event) => updateProfile((current) => ({ ...current, savingsCurrent: Math.max(0, Number(event.target.value) || 0) }))} inputMode="decimal" />
                </Field>
                <Field label="Currency">
                  <TextInput value={profile.currency} onChange={(event) => updateProfile((current) => ({ ...current, currency: event.target.value }))} />
                </Field>
                <Field label="Monthly income">
                  <TextInput value={String(profile.monthlyIncome)} onChange={(event) => updateProfile((current) => ({ ...current, monthlyIncome: Math.max(0, Number(event.target.value) || 0) }))} inputMode="decimal" />
                </Field>
                <Field label="Monthly expenses">
                  <TextInput value={String(profile.monthlyExpenses)} onChange={(event) => updateProfile((current) => ({ ...current, monthlyExpenses: Math.max(0, Number(event.target.value) || 0) }))} inputMode="decimal" />
                </Field>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[#8D93B8]">Prayer times</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(Object.keys(profile.prayerTimes) as CapitalizedPrayerKey[]).map((key) => (
                  <Field key={key} label={key}>
                    <TextInput type="time" value={profile.prayerTimes[key]} onChange={(event) => updateProfile((current) => ({ ...current, prayerTimes: { ...current.prayerTimes, [key]: event.target.value } }))} />
                  </Field>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#F3EEE2]">Random check-ins</div>
                  <p className="text-sm text-[#8D93B8]">Enable or disable periodic mindfulness prompts.</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateProfile((current) => ({ ...current, checkinEnabled: !current.checkinEnabled }))}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    profile.checkinEnabled ? "bg-[#4FB08A]/10 text-[#C8F0E2]" : "bg-white/5 text-[#8D93B8]",
                  )}
                >
                  {profile.checkinEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleTestNotification} className="rounded-full bg-[#E8A33D] px-5 py-3 text-sm font-semibold text-[#0E1226] transition hover:opacity-90">
                Test notification
              </button>
              <button type="button" onClick={() => setShowSettings(false)} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[#F3EEE2] transition hover:bg-white/10">
                Done
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showCheckinModal ? (
        <Modal
          title={checkinSource === "notification" ? "Check-in reminder" : "Add activity"}
          description="Write down what you are doing right now."
          onClose={() => setShowCheckinModal(false)}
        >
          <div className="space-y-4">
            <Field label="Activity">
              <TextArea value={checkinText} onChange={(event) => setCheckinText(event.target.value)} placeholder="Studying, walking, praying, working, resting..." />
            </Field>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={submitCheckin} className="rounded-full bg-[#E8A33D] px-5 py-3 text-sm font-semibold text-[#0E1226] transition hover:opacity-90">
                Save activity
              </button>
              <button type="button" onClick={() => setShowCheckinModal(false)} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-[#F3EEE2] transition hover:bg-white/10">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
