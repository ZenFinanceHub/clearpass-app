/**
 * All Daily Coach Home copy in one place, for review (spec §3.3).
 * Pure strings and small formatters; no imports.
 */

export const TOPIC_NAMES: Record<string, string> = {
  Alertness: 'Alertness',
  Attitude: 'Attitude',
  SafetyAndYourVehicle: 'Safety & Your Vehicle',
  SafetyMargins: 'Safety Margins',
  HazardAwareness: 'Hazard Awareness',
  VulnerableRoadUsers: 'Vulnerable Road Users',
  OtherTypes: 'Other Types of Vehicle',
  VehicleHandling: 'Vehicle Handling',
  MotorwayRules: 'Motorway Rules',
  RulesOfTheRoad: 'Rules of the Road',
  RoadAndTrafficSigns: 'Road & Traffic Signs',
  DocumentsAndRegulations: 'Documents & Regulations',
  AccidentsAndEmergencies: 'Accidents & Emergencies',
  VehicleLoading: 'Vehicle Loading',
};

export const topicName = (key: string): string => TOPIC_NAMES[key] ?? key;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const copy = {
  greeting: {
    title: (name: string | null) => (name ? `Hi ${name}` : 'Hi there'),
    loading: 'Getting your plan ready…',
    error: "We couldn't load your progress.",
    new: "Let's get your theory test prep started.",
    studiedToday: 'Nice work today. Keep it going!',
    default: "Here's your plan for today.",
  },
  countdown: {
    days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    daysSub: 'to your test',
    today: 'Test day',
    todaySub: 'Good luck!',
    none: 'Add test date',
    noneSub: 'Optional',
    past: 'Test done?',
    pastSub: 'Tell us how it went',
  },
  // Pip's headline: context about the learner. The advice line underneath
  // comes from the recommendation, so the CTA always acts on what Pip says.
  headline: {
    loading: 'Just a moment',
    error: 'Hmm, something went wrong',
    new: "Hi, I'm Pip!",
    testDay: "It's test day!",
    testPast: 'How did your test go?',
    mockPassed: 'You passed your last mock!',
    streakAtRisk: (n: number) => `Keep your ${n}-day streak going`,
    finalWeek: (n: number) => `${plural(n, 'day')} to go`,
    streak: (n: number) => `${n}-day streak!`,
    returning: 'Welcome back!',
    steady: "Here's your next step",
    // Used when no context rule applies, so the headline matches the advice.
    byRec: {
      'first-practice': "Let's get started",
      'test-day': "It's nearly time",
      'due-review': 'Time for a quick review',
      'free-mock': 'Ready for a mock?',
      'pro-mock': 'Ready for a mock?',
      'weak-topic': "Let's sharpen up",
      hazard: 'Next milestone: hazards',
      mixed: 'Keep it rolling',
    } as Record<string, string>,
  },
  advice: {
    loading: 'Getting your plan ready…',
    error: "I couldn't load your progress. Check your connection and try again.",
  },
  rec: {
    first: {
      advice: "Let's find your level with a short set of questions. No pressure.",
      cta: 'Start your first practice',
    },
    testDay: { advice: 'Have a calm look through your test-day checklist before you go.', cta: 'Open test-day checklist' },
    due: (n: number) => ({
      advice: `${plural(n, 'question')} ${n === 1 ? 'is' : 'are'} due for review. About ${Math.max(1, Math.ceil(n * 0.5))} min and ${n === 1 ? 'it' : 'they'}'ll stick.`,
      cta: 'Start review',
    }),
    freeMock: { advice: "You're ready for your free Quick Mock: 25 questions in 28 minutes, pass mark 22.", cta: 'Start free Quick Mock' },
    proMock: { advice: 'A mock under real exam conditions is the best practice now.', cta: 'Start a mock test' },
    weakTopic: (topic: string, score: number) => ({
      advice: `${topic} is your trickiest topic at ${score}%. A focused set will lift it.`,
      cta: `Practise ${topic}`,
    }),
    hazard: { advice: 'Hazard perception is your next milestone. Try a few clips.', cta: 'Practise hazard clips' },
    mixed: { advice: 'Keep the momentum going with a mixed set across every topic.', cta: 'Start practice' },
  },
  plan: {
    questions: (target: number) => `Answer ${target} questions`,
    challenge: "Today's challenge",
    mock: 'Take a mock test',
    streak: 'Study today to keep your streak',
    startStreak: 'Study today to start a streak',
  },
  streak: {
    label: (n: number) => (n === 0 ? 'Start today' : `${n}-day streak`),
    atRisk: 'Study today to keep it',
    safe: 'Keep it up!',
    zero: 'Every streak starts with one set',
  },
  roadmap: {
    title: 'Road to Test Ready',
    readyBadge: (n: number) => `${n}% ready`,
    journeyBadge: 'Journey started',
    journeyLine: (needed: number) => `Answer ${plural(needed, 'more question')} to see your readiness score.`,
    explainer:
      '“% ready” estimates your chance of passing, from your mock scores, accuracy and topic coverage. The road shows four milestones: Road signs, Rules, Hazards and Test ready.',
  },
  quick: { mock: 'Mock tests', hazards: 'Hazards', signs: 'Road signs', pip: 'Ask Pip' },
  pro: {
    eyebrow: 'ClearPass Pro',
    headline: {
      testSoon: (days: number) => (days === 0 ? 'Your test is today' : days === 1 ? 'Your test is tomorrow' : `Your test is in ${days} days`),
      mockShort: (score: number, total: number, passMark: number) => `Last mock ${score}/${total}. Pass mark ${passMark}.`,
      limitReached: (limit: number) => `You've used today's ${limit} free questions`,
      default: 'Get test-ready faster',
    },
    sub: {
      testSoon: 'Unlimited practice and mocks between now and then.',
      mockShort: 'Unlimited mocks to close the gap.',
      limitReached: 'Keep going today with unlimited practice.',
      default: 'Everything you need to pass, without daily limits.',
    },
    cta: 'See Pro plans',
  },
  freeMock: {
    title: 'Your free mock test',
    body: '25 questions, 28 minutes. See your score against the pass mark.',
    cta: 'Start mock',
  },
  retry: 'Try again',
} as const;

/**
 * Pro benefits, each verified against the gating code (file:line in the
 * P2-1 PR description). `nativeOnly` items get a web variant.
 */
export const PRO_BENEFITS = [
  { id: 'questions', text: (freeLimit: number) => `Unlimited practice questions (free: ${freeLimit} a day)` },
  { id: 'mocks', text: () => 'Unlimited mock tests (free: one Quick Mock)' },
  { id: 'hazard', text: () => 'Hazard perception clips, scored like the DVSA test', web: 'Hazard perception clips in the iOS and Android app' },
  { id: 'pip', text: () => 'Ask Pip: 20 AI explanations a day (free: 10 in total)' },
  { id: 'freeze', text: () => 'Streak freezes, so one missed day doesn’t reset you' },
] as const;
