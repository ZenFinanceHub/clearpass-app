// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const vehicleHandlingQuestions: Question[] = [
  {
    id: 'VHN_001',
    questionText: 'Your rear wheels lose grip and the rear of the car skids to the right. What is the correct initial response?',
    options: [
      'Brake firmly and steer hard to the left',
      'Ease off the accelerator and steer gently to the right (into the skid)',
      'Apply the handbrake to slow the rear wheels',
      'Accelerate to push the rear wheels back into line',
    ],
    correctIndex: 1,
    explanation:
      'In a rear-wheel skid (oversteer), the correct response is to ease off the throttle and steer gently in the same direction the rear is sliding - into the skid. This helps the rear tyres regain grip. Avoid harsh braking.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_002',
    questionText: 'Your car begins to aquaplane on a wet road. What should you do?',
    options: [
      'Brake firmly to stop the vehicle as quickly as possible',
      'Ease off the accelerator gently and avoid sudden steering until grip returns',
      'Steer sharply to find a dry patch of road surface',
      'Apply the handbrake to slow the rear wheels',
    ],
    correctIndex: 1,
    explanation:
      'During aquaplaning, the tyres are riding on a film of water. Braking or steering sharply will have little effect and can cause a skid. Ease gently off the accelerator and hold the steering lightly until the tyres regain contact with the road.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_003',
    questionText: 'When driving in snowy conditions, which gear should you aim to use when moving off?',
    options: [
      'First gear with plenty of engine revs to push through the snow',
      'Second gear to reduce wheel spin',
      'Reverse gear, as it provides more torque',
      'Any gear - the selection makes no difference in snow',
    ],
    correctIndex: 1,
    explanation:
      'In snow and ice, moving off in second gear (or using a specific winter/snow mode if available) reduces wheel spin. High torque in first gear causes the driven wheels to spin, losing traction. Use gentle acceleration and smooth inputs.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_004',
    questionText: 'When should you use your rear fog lights?',
    options: [
      'Whenever it is raining heavily',
      'When visibility drops below approximately 100 metres due to fog or other conditions',
      'Whenever it is dark or dusk',
      'Whenever your visibility feels reduced',
    ],
    correctIndex: 1,
    explanation:
      'Rear fog lights should be used when visibility is seriously reduced - specifically when you cannot see more than approximately 100 metres ahead. Using them unnecessarily dazzles following drivers and masks your brake lights.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_005',
    questionText: 'What is meant by "engine braking"?',
    options: [
      'Applying both the footbrake and handbrake simultaneously',
      'Using a lower gear to slow the vehicle, reducing reliance on the footbrake',
      'A feature that automatically limits engine speed to prevent over-revving',
      'Braking while the engine is still running, rather than switching it off',
    ],
    correctIndex: 1,
    explanation:
      'Engine braking means selecting a lower gear to slow the vehicle using the resistance of the engine, rather than relying solely on the footbrake. It is particularly useful on long descents to prevent brake fade.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_006',
    questionText: 'Which type of vehicle is most affected by strong crosswinds?',
    options: [
      'Low, wide sports cars',
      'Motorcycles, high-sided vehicles, and vehicles towing trailers',
      'Front-wheel-drive saloon cars',
      'Heavy lorries due to their weight',
    ],
    correctIndex: 1,
    explanation:
      'Motorcycles are vulnerable to crosswinds due to their light weight and narrow profile. High-sided vehicles (lorries, caravans, motor homes) are pushed sideways by their large surface area. Both require reduced speed and extra care in exposed locations.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_007',
    questionText: 'You are about to drive through a flooded ford. What should you do afterwards?',
    options: [
      'Drive at high speed to splash water off the brakes quickly',
      'Test your brakes gently as soon as it is safe to do so',
      'Avoid using the brakes for two miles to allow them to dry naturally',
      'Brakes are waterproof and require no special action',
    ],
    correctIndex: 1,
    explanation:
      'After driving through water, brakes may be wet and less effective. Test them gently as soon as it is safe by applying light pressure. This generates heat that dries the pads and restores normal braking performance.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_008',
    questionText: 'Your vehicle pulls to one side when you brake. What is the most likely cause and what should you do?',
    options: [
      'The road is cambered - this is normal on older roads',
      'There is a brake fault - stop safely and get the vehicle checked before driving further',
      'The tyre pressures are slightly unequal - adjust them at the next opportunity',
      'This is normal when the brakes are cold - it will stop once they warm up',
    ],
    correctIndex: 1,
    explanation:
      'Pulling to one side under braking indicates unequal braking force, often caused by a faulty caliper, uneven pad wear, or a seized component. This is a safety-critical defect - stop safely and do not continue driving until it has been investigated.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_009',
    questionText: 'What is the correct hand position and steering technique recommended for modern vehicles?',
    options: [
      'Both hands at the 12 o\'clock position for maximum control',
      'Hands at around the "ten-to-two" or "quarter-to-three" position, using a push-pull technique',
      'One hand on the wheel to allow elbow support on the door for long journeys',
      'Hands at "eight-twenty" to allow deployment of the central airbag',
    ],
    correctIndex: 1,
    explanation:
      'Hands should be positioned at around ten-to-two or quarter-to-three on the steering wheel. Use a push-pull (shuffle) technique rather than crossing your arms. This maintains control and allows for rapid response to hazards.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_010',
    questionText: 'Why is it especially dangerous to brake heavily while cornering?',
    options: [
      'It causes the tyres to overheat and reduces traction',
      'It transfers weight to the front, reduces rear grip, and can cause a spin or loss of control',
      'It causes the ABS to activate, which disables steering temporarily',
      'Modern cars are designed to handle heavy braking in corners without any risk',
    ],
    correctIndex: 1,
    explanation:
      'Braking while cornering transfers weight to the front of the vehicle and reduces grip at the rear. This can cause the rear to break away (oversteer), resulting in a spin. The correct approach is to reduce speed before entering the bend.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_011',
    questionText: 'What is "brake fade" and when is it most likely to occur?',
    options: [
      'A gradual reduction in braking effectiveness caused by overheated brakes, typically on long descents',
      'Reduced braking when the brake pads are worn below the minimum thickness',
      'Loss of brake pressure caused by a small fluid leak from the brake master cylinder',
      'Delayed braking response caused by wet brake discs after driving through water',
    ],
    correctIndex: 0,
    explanation:
      'Brake fade occurs when brakes overheat after prolonged use, such as on a long downhill gradient. The braking fluid can boil, causing a spongy pedal and reduced stopping power. Use engine braking (lower gears) on long descents to reduce reliance on the footbrake.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_012',
    questionText: 'You are driving at night in fog with a vehicle close behind you. Why might you be reluctant to use rear fog lights?',
    options: [
      'Rear fog lights are illegal when another vehicle is within 50 metres',
      'They can dazzle the driver behind and mask your brake lights',
      'Rear fog lights reduce battery life and may affect headlight brightness',
      'They are only permitted on motorways in conditions of reduced visibility',
    ],
    correctIndex: 1,
    explanation:
      'Rear fog lights are very bright and can dazzle drivers following closely. They also make it harder to see brake lights. However, if visibility is seriously reduced (below 100 metres), safety requires their use regardless. Switch them off when no longer needed.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_013',
    questionText: 'What effect does a fully loaded roof rack have on vehicle handling?',
    options: [
      'It lowers the centre of gravity and improves cornering stability',
      'It raises the centre of gravity and increases the risk of rollovers, especially on bends',
      'It has minimal effect if the weight is within the roof load limit',
      'It improves straight-line stability by adding downforce',
    ],
    correctIndex: 1,
    explanation:
      'Weight on the roof raises the vehicle\'s centre of gravity, making it more top-heavy and increasing the risk of tipping in corners. It also increases fuel consumption and affects braking distances. Always stay within the manufacturer\'s roof load limit.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_014',
    questionText: 'Your accelerator pedal sticks while driving. What is the correct immediate action?',
    options: [
      'Brake hard immediately and hope the engine slows down',
      'Select neutral, brake to a controlled stop, and switch off the engine',
      'Pump the accelerator several times to free the mechanism',
      'Turn off the ignition immediately while the vehicle is still moving',
    ],
    correctIndex: 1,
    explanation:
      'If the accelerator sticks, put the vehicle into neutral to disconnect the drive, brake smoothly to a halt, then switch off the engine when stopped. Turning the ignition off while moving can lock the steering column on some vehicles.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_015',
    questionText: 'In snowy conditions, what should you do to reduce the risk of skidding when approaching a bend?',
    options: [
      'Apply gentle braking throughout the bend to maintain control',
      'Reduce speed before the bend and drive through it smoothly with minimal steering input',
      'Accelerate through the bend to maintain forward momentum',
      'Select a lower gear in the middle of the bend to increase control',
    ],
    correctIndex: 1,
    explanation:
      'In snow or ice, the key is to reduce speed well before the bend, then drive through it gently. Braking, accelerating, or making sudden steering inputs while cornering dramatically increases the risk of a skid. Smooth, gentle inputs are essential.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
];
