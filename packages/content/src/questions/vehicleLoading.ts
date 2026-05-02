// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const vehicleLoadingQuestions: Question[] = [
  {
    id: 'VLD_001',
    questionText: 'How does a heavy load in the boot of a car affect vehicle handling?',
    options: [
      'It improves grip at the rear and shortens braking distances',
      'It makes the steering feel lighter and the front less responsive',
      'It lowers the centre of gravity and stabilises the car in corners',
      'It reduces fuel consumption by increasing traction',
    ],
    correctIndex: 1,
    explanation:
      'A heavy load in the boot transfers weight to the rear axle, reducing grip on the front wheels. This makes steering lighter and less responsive, and can cause the headlights to point upward, dazzling other drivers. Adjust headlight aim if loading heavily.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_002',
    questionText: 'What is the greatest danger of overloading a vehicle?',
    options: [
      'Increased fuel consumption only',
      'Reduced braking efficiency, poor handling, and increased risk of tyre failure',
      'The vehicle may fail its next MOT',
      'The engine may overheat on long journeys',
    ],
    correctIndex: 1,
    explanation:
      'Overloading a vehicle can cause tyre failure from excessive heat, longer braking distances, poor handling, and structural damage to the vehicle. It is also illegal - exceeding the vehicle\'s maximum authorised mass (MAM) carries a significant fine.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_003',
    questionText: 'You are carrying a long load that overhangs the rear of your vehicle. What is required?',
    options: [
      'Nothing if the overhang is less than 2 metres',
      'A clearly visible rear marker (red flag or light) to warn following drivers',
      'A police escort for any overhang',
      'Nothing - overhanging loads are permitted without restriction',
    ],
    correctIndex: 1,
    explanation:
      'Any load that overhangs the rear of a vehicle must be made clearly visible. During daylight a red flag must be attached; at night or in poor visibility a red light is required. An overhang of more than 1 metre beyond the rear of the vehicle must be marked.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_004',
    questionText: 'How does towing a trailer affect your braking distance?',
    options: [
      'It has no effect - modern braking systems compensate automatically',
      'It significantly increases braking distances as the combined weight is greater',
      'It reduces braking distance because the trailer adds downward force',
      'Only affects braking if the trailer has no independent brakes',
    ],
    correctIndex: 1,
    explanation:
      'Towing a trailer greatly increases the total weight of the combination, which means braking distances are significantly longer. Allow for this by increasing your following distance. The effect is greater on wet or slippery roads.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_005',
    questionText: 'What is "snaking" (also called "trailer sway") and what is the correct response?',
    options: [
      'The trailer jack-knifing at low speeds - steer into the sway to correct it',
      'The trailer swaying side to side at speed - ease off the accelerator and do not brake sharply',
      'The trailer bouncing excessively - brake hard to reduce speed quickly',
      'The trailer steering pulling the car off-course - steer against the pull firmly',
    ],
    correctIndex: 1,
    explanation:
      'Snaking (trailer sway) occurs when a trailer oscillates side to side, often caused by excessive speed or an unbalanced load. Ease off the accelerator gradually - do not brake sharply as this can make the sway worse. Reduce speed until the trailer stabilises.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_006',
    questionText: 'Where should the heaviest items be placed when loading a van or estate car?',
    options: [
      'As high as possible to keep the floor area free',
      'As far back as possible to improve rear traction',
      'As low as possible and as far forward as possible, secured against movement',
      'On top of lighter items to minimise shifting in transit',
    ],
    correctIndex: 2,
    explanation:
      'Heavy items should be placed low in the load space and as far forward as practical to avoid raising the centre of gravity or overloading the rear axle. All loads must be secured to prevent movement that could affect handling or injure occupants.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_007',
    questionText: 'What effect does a roof-mounted box or load have on fuel consumption and vehicle stability?',
    options: [
      'It slightly reduces fuel consumption due to aerodynamic benefits',
      'It increases fuel consumption and raises the centre of gravity, increasing rollover risk',
      'It has no effect on stability if the load is within the roof load limit',
      'It improves stability in crosswinds due to the additional weight above',
    ],
    correctIndex: 1,
    explanation:
      'A loaded roof box increases wind resistance (increasing fuel consumption significantly) and raises the vehicle\'s centre of gravity, making it more susceptible to rollovers in corners and crosswinds. Always stay within the manufacturer\'s roof load rating.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_008',
    questionText: 'What is the maximum authorised mass (MAM) of a vehicle?',
    options: [
      'The maximum speed the vehicle can legally travel on a motorway',
      'The maximum total weight of the vehicle including its maximum permitted load and passengers',
      'The weight of the vehicle when completely empty with no fuel',
      'The maximum payload the vehicle can carry in the load area only',
    ],
    correctIndex: 1,
    explanation:
      'The Maximum Authorised Mass (MAM), also called Gross Vehicle Weight (GVW), is the total permissible weight of the vehicle including its own weight, fuel, passengers, and all cargo. Exceeding it is illegal and dangerous.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_009',
    questionText: 'You are towing a caravan and it begins to sway violently. What is the correct response?',
    options: [
      'Accelerate out of the sway to pull the caravan straight',
      'Brake hard to bring both vehicles to a stop quickly',
      'Ease off the accelerator and hold the steering wheel straight, without braking sharply',
      'Steer sharply in the opposite direction of the sway to counteract it',
    ],
    correctIndex: 2,
    explanation:
      'If a caravan starts to sway violently, ease off the accelerator gently and hold the steering straight. Do not brake hard or steer sharply - this can worsen the sway and cause a jack-knife. Allow speed to fall naturally until stability returns.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_010',
    questionText: 'How should you secure loose items in the boot of a car to prevent them becoming dangerous in a collision?',
    options: [
      'Stack them in the spare wheel well where they cannot move',
      'Use cargo nets, straps, or a boot organiser to prevent items shifting',
      'Place heavy items in the footwell of the rear seats instead',
      'Loose items in a closed boot are safe as the boot absorbs impact',
    ],
    correctIndex: 1,
    explanation:
      'Unsecured items in a car become dangerous projectiles in a crash. Even a 1 kg object travelling at speed inside the car can cause fatal injuries. Use cargo nets, boot dividers, or proper straps to secure all loose loads.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_011',
    questionText: 'What speed limit applies to a car towing a caravan or trailer on a single carriageway road?',
    options: [
      '40mph',
      '50mph',
      '60mph',
      'The same as for cars without trailers',
    ],
    correctIndex: 1,
    explanation:
      'On a single carriageway road, the maximum speed for a car towing a caravan or trailer is 50mph. On a dual carriageway or motorway the limit is 60mph. These limits apply even where the national speed limit would allow more.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_012',
    questionText: 'What is a noseweight and why is it important when towing a caravan?',
    options: [
      'The angle of the towball coupling - must be level to prevent sway',
      'The downward force the caravan exerts on the towball - must be within the towing vehicle\'s limits',
      'The maximum speed at which the towing vehicle\'s nose will lift',
      'The weight of items stored in the caravan\'s front storage compartment',
    ],
    correctIndex: 1,
    explanation:
      'Noseweight is the downward force the caravan\'s coupling exerts on the vehicle\'s towball. Too little noseweight causes sway; too much overloads the rear of the towing vehicle and lifts the front wheels, reducing steering. Both the vehicle and caravan specify permitted noseweight ranges.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_013',
    questionText: 'Carrying a full load of passengers significantly affects which aspect of driving?',
    options: [
      'Only fuel economy - handling remains unaffected',
      'Braking distances, acceleration, and handling - all are affected by the additional weight',
      'Steering only - extra weight at the rear makes the front lighter',
      'Visibility only - passengers obstruct mirrors and rear windows',
    ],
    correctIndex: 1,
    explanation:
      'Carrying additional passengers increases the total vehicle weight, extending braking distances, reducing acceleration, and affecting handling. Allow for longer stopping distances and adapt your driving accordingly when the vehicle is heavily loaded.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_014',
    questionText: 'What must you check before setting off when towing a trailer?',
    options: [
      'Only that the trailer lights are working',
      'That the trailer is securely attached, lights work, tyres are correct, load is secured, and mirrors give adequate view',
      'Only that the towball coupling is locked',
      'That the trailer weight is under 750 kg, as above this no checks are needed',
    ],
    correctIndex: 1,
    explanation:
      'Before towing you must check: the coupling is secure and the safety chain is attached, all trailer lights and indicators work, trailer tyre pressures and condition are correct, the load is secured and within legal limits, and your mirrors provide an adequate field of view.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_015',
    questionText: 'A load of sand in an open pickup truck is not secured. Why is this a problem?',
    options: [
      'The load may shift during cornering, affecting handling only',
      'The load may blow off and cause a hazard or injury to other road users - securing it is a legal requirement',
      'It is only a problem on motorways where wind speeds are higher',
      'Open loads are permitted without restriction if they are within the vehicle\'s MAM',
    ],
    correctIndex: 1,
    explanation:
      'Loads that can blow or fall off a vehicle are a serious hazard to other road users and can cause fatal collisions. It is a legal requirement to ensure all loads are secured and cannot fall or be blown from the vehicle. The driver and operator can face prosecution.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
];
