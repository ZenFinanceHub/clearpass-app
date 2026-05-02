// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const safetyAndYourVehicleQuestions: Question[] = [
  {
    id: 'SVH_001',
    questionText: 'What is the minimum legal tyre tread depth for a car in the UK?',
    options: [
      '1mm across the full width of the tyre',
      '1.6mm across the central three-quarters of the tyre',
      '2mm across the central three-quarters of the tyre',
      '3mm across the full width of the tyre',
    ],
    correctIndex: 1,
    explanation:
      'The minimum legal tread depth is 1.6mm across the central three-quarters of the tread width, around the entire circumference of the tyre. Most tyre manufacturers recommend changing tyres at 3mm for safety.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 1,
  },
  {
    id: 'SVH_002',
    questionText: 'You want to check the engine oil level. When is the best time to do this?',
    options: [
      'Immediately after turning off the engine after a long drive',
      'When the engine is cold and the car is on level ground',
      'With the engine running at idle speed',
      'Only when the oil warning light illuminates',
    ],
    correctIndex: 1,
    explanation:
      'Oil should be checked when the engine is cold and the car is on level ground. This allows oil to drain back into the sump, giving an accurate reading on the dipstick between the minimum and maximum markers.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 1,
  },
  {
    id: 'SVH_003',
    questionText: 'When should you check your tyre pressures?',
    options: [
      'Immediately after a long motorway journey when tyres are warm',
      'When the tyres are cold, before a long journey',
      'Once a month regardless of temperature',
      'Only when the vehicle feels unstable at high speed',
    ],
    correctIndex: 1,
    explanation:
      'Tyre pressure should be checked when the tyres are cold, as driving increases pressure temporarily. Check before long journeys or at least once a month. Correct pressures are shown in the vehicle handbook and often inside the fuel cap.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 1,
  },
  {
    id: 'SVH_004',
    questionText: 'Your oil warning light comes on while driving. What should you do?',
    options: [
      'Continue to your destination as it is likely a sensor fault',
      'Stop as soon as safely possible and check the oil level',
      'Drive slowly at below 30mph to reduce engine damage',
      'Top up with oil at the next petrol station without stopping',
    ],
    correctIndex: 1,
    explanation:
      'An illuminated oil warning light indicates low oil pressure, which can cause serious engine damage within seconds. Stop safely as soon as possible, switch off the engine, and check the oil level before proceeding.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 1,
  },
  {
    id: 'SVH_005',
    questionText: 'What is the purpose of an Anti-lock Braking System (ABS)?',
    options: [
      'It shortens stopping distance on all road surfaces',
      'It prevents wheels locking under heavy braking, allowing the driver to maintain steering control',
      'It automatically applies maximum braking force in an emergency',
      'It reduces wear on brake pads by limiting braking force',
    ],
    correctIndex: 1,
    explanation:
      'ABS prevents wheels from locking during emergency braking. Locked wheels cause loss of steering. With ABS, you can apply maximum brake pressure and still steer around obstacles. ABS does not always shorten stopping distance on loose surfaces.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 2,
  },
  {
    id: 'SVH_006',
    questionText: 'You are driving and notice that steering requires much more effort than usual. What is the most likely cause?',
    options: [
      'The front tyres are over-inflated',
      'Power steering failure',
      'The wheel alignment is slightly out',
      'The road surface is causing extra resistance',
    ],
    correctIndex: 1,
    explanation:
      'A sudden increase in steering effort usually indicates power steering failure. You can still steer the vehicle but will need much greater physical force. Slow down gradually and get the fault investigated before driving further.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 2,
  },
  {
    id: 'SVH_007',
    questionText: 'When should your vehicle first have an MOT test?',
    options: [
      'After one year from first registration',
      'After two years from first registration',
      'After three years from first registration',
      'After four years from first registration',
    ],
    correctIndex: 2,
    explanation:
      'A vehicle must have its first MOT test when it is three years old. After that, an annual MOT is required. Vehicles manufactured before a certain date may be exempt from MOT as historic vehicles.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 1,
  },
  {
    id: 'SVH_008',
    questionText: 'Where should new tyres be fitted if you are only replacing two?',
    options: [
      'On the front axle, to improve steering response',
      'On the rear axle, to reduce the risk of oversteer',
      'On whichever axle has the most worn tyres',
      'It does not matter which axle',
    ],
    correctIndex: 1,
    explanation:
      'New tyres should be fitted to the rear axle. Rear tyre failure causes oversteer, which is much harder to control than understeer caused by front tyre failure. Fitting new tyres to the rear improves overall stability.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 3,
  },
  {
    id: 'SVH_009',
    questionText: 'When using ABS brakes in an emergency, what is the correct technique?',
    options: [
      'Pump the brake pedal rapidly to avoid wheel lock',
      'Apply firm, continuous pressure to the brake pedal and steer as needed',
      'Apply moderate pressure only - never stamp on the brake pedal',
      'Press the brake pedal firmly and hold the steering wheel straight',
    ],
    correctIndex: 1,
    explanation:
      'With ABS, apply firm, continuous pressure to the brake pedal - do not pump it. The ABS system modulates brake pressure automatically to prevent wheel lock. You can continue to steer while braking firmly.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 2,
  },
  {
    id: 'SVH_010',
    questionText: 'What does a flashing brake warning light on your dashboard most likely indicate?',
    options: [
      'The brake fluid is overheating after sustained use',
      'The brake fluid level is low or there is a fault with the braking system',
      'The ABS is currently active',
      'The handbrake is partially engaged',
    ],
    correctIndex: 1,
    explanation:
      'A brake warning light usually indicates low brake fluid or a fault in the braking system. This is a serious safety issue. Do not continue driving - stop safely, check the fluid level, and seek professional assistance before driving further.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 2,
  },
  {
    id: 'SVH_011',
    questionText: 'Why is it important to check your windscreen wipers regularly?',
    options: [
      'Worn wipers can scratch the windscreen and reduce visibility in rain',
      'Worn wipers increase fuel consumption significantly',
      'Faulty wipers are an immediate MOT failure and carry a fine',
      'Wipers affect the aerodynamics and top speed of the vehicle',
    ],
    correctIndex: 0,
    explanation:
      'Worn or damaged wiper blades leave smears and miss areas of the windscreen, reducing visibility in rain. In heavy rain, visibility can be reduced to near zero with faulty wipers. Wiper condition is checked as part of the MOT.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 1,
  },
  {
    id: 'SVH_012',
    questionText: 'What is the purpose of the vehicle\'s coolant/antifreeze?',
    options: [
      'It lubricates the engine cylinders during cold starts',
      'It regulates engine temperature and prevents freezing in winter',
      'It cleans fuel injectors and improves combustion efficiency',
      'It protects brake lines from corrosion',
    ],
    correctIndex: 1,
    explanation:
      'Coolant (antifreeze) circulates through the engine to remove heat and prevent overheating. In winter it also prevents the water in the cooling system from freezing, which could crack the engine block. The level should be checked regularly.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 2,
  },
  {
    id: 'SVH_013',
    questionText: 'Your car starts to pull to one side under braking. What does this most likely indicate?',
    options: [
      'The steering alignment is out - a normal wear item',
      'A possible brake fault such as a seized caliper or uneven pad wear',
      'One of the front tyres is under-inflated',
      'The road surface is cambered heavily to one side',
    ],
    correctIndex: 1,
    explanation:
      'Pulling to one side when braking is a sign of unequal braking force, often caused by a seized brake caliper, worn brake pads on one side, or contaminated brake discs. This is a safety-critical fault that must be investigated immediately.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 3,
  },
  {
    id: 'SVH_014',
    questionText: 'What is the legal requirement regarding vehicle defects you discover after an MOT certificate has been issued?',
    options: [
      'You can drive the vehicle freely until the MOT expires',
      'You are responsible for keeping the vehicle in a roadworthy condition at all times',
      'Defects discovered after an MOT are covered for 30 days',
      'You must return the vehicle to the MOT station within a week',
    ],
    correctIndex: 1,
    explanation:
      'An MOT certificate confirms a vehicle met minimum safety standards at the time of test. The driver is legally responsible for ensuring their vehicle is roadworthy at all times. A defect discovered after the MOT must be repaired before driving.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 2,
  },
  {
    id: 'SVH_015',
    questionText: 'What should you do if you notice your vehicle\'s headlights are not working properly before setting off at night?',
    options: [
      'Drive carefully with hazard lights on until you can reach a garage',
      'Do not drive the vehicle until the headlights have been repaired',
      'Drive at reduced speed keeping to well-lit roads only',
      'Use fog lights as a substitute for headlights',
    ],
    correctIndex: 1,
    explanation:
      'Driving at night without properly functioning headlights is illegal and extremely dangerous. You must not drive the vehicle until the fault is repaired. Fog lights are not a substitute - they are designed for low-visibility conditions, not normal night driving.',
    topicCategory: TopicCategory.SafetyAndYourVehicle,
    difficulty: 1,
  },
];
