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
    new: "Let's get your theory test prep started.",
    studiedToday: 'Nice work today. Keep it going!',
    default: "Let's keep up the great progress.",
  },
  countdown: {
    days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    daysSub: 'until your test',
    today: 'Test day',
    todaySub: 'Good luck today!',
    none: 'Set a test date',
    noneSub: 'Optional',
    past: 'Test date passed',
    pastSub: 'How did it go?',
  },
  pip: {
    loading: { title: 'Just a moment', message: 'Getting your plan ready…' },
    new: { title: "Hi, I'm Pip!", message: "Start with a short practice set and I'll shape your plan around how you do." },
    testDay: { title: "It's test day!", message: "Read each question twice and take your time. You've prepared for this." },
    testPast: { title: 'How did it go?', message: 'Tell me how your test went. You can let me know from Home or Profile.' },
    mockPassed: { title: 'You passed your last mock!', message: "That's exactly the form you want for test day. Keep it steady." },
    streakAtRisk: (n: number) => ({ title: `Your ${n}-day streak is waiting`, message: 'A few questions today keeps it going.' }),
    finalWeek: (n: number) => ({ title: `${plural(n, 'day')} to go`, message: 'Mock tests are the best warm-up now. Little and often.' }),
    streak: (n: number) => ({ title: `${n}-day streak!`, message: "You're building a real habit. That's what gets people through." }),
    weakTopic: (topic: string) => ({ title: "Let's sharpen up", message: `${topic} is your trickiest topic right now. A focused set will help.` }),
    returning: { title: 'Welcome back!', message: "Let's ease back in with a short set. You'll pick it up fast." },
    steady: { title: "You're making progress!", message: 'Keep going. Every set moves you further down the road.' },
  },
  rec: {
    first: { title: 'Start your first practice', description: 'A short set of questions to find your level.', cta: 'Start now' },
    testDay: { title: 'Get ready for test day', description: 'Your final checklist and calm-down tips.', cta: 'Open' },
    due: (n: number) => ({
      title: `Review ${plural(n, 'due question')}`,
      description: `About ${Math.max(1, Math.ceil(n * 0.5))} min. Spaced repetition locks it in.`,
      cta: 'Start review',
    }),
    freeMock: { title: 'Take your free Quick Mock', description: '25 questions in 28 minutes. See your score against the pass mark of 22.', cta: 'Start mock' },
    proMock: { title: 'Take a mock test', description: 'Practise under real exam conditions.', cta: 'Start mock' },
    weakTopic: (topic: string, score: number) => ({
      title: `Practise ${topic}`,
      description: `Your weakest topic at ${score}%. Pick it on the practice screen.`,
      cta: 'Practise',
    }),
    hazard: { title: 'Practise hazard perception', description: 'Build your skills with realistic clips.', cta: 'Start now' },
    mixed: { title: 'Keep your momentum', description: 'A mixed set of questions across every topic.', cta: 'Start now' },
  },
  plan: {
    questions: (target: number) => `Answer ${target} questions`,
    challenge: "Complete today's challenge",
    mock: 'Take a mock test',
    streak: 'Study today to keep your streak',
  },
  streak: {
    label: (n: number) => (n === 1 ? '1 day' : `${n} days`),
    atRisk: 'Study today to keep it',
    safe: 'Keep it up!',
    none: 'Start one today',
  },
  quick: { mock: 'Mock tests', hazards: 'Hazards', signs: 'Road signs', pip: 'Ask Pip' },
  upgrade: {
    freeMockTitle: 'Your free mock test',
    freeMockBody: '25 questions, 28 minutes. See your score against the pass mark.',
    proTitle: 'Go Pro',
  },
} as const;
