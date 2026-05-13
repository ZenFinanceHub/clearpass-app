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
  {
    id: 'VHN_016',
    questionText: 'What is "coasting" and why is it discouraged?',
    options: [
      'Driving with windows open to reduce drag - it wastes fuel',
      'Travelling with the clutch depressed or in neutral, which reduces engine braking and control',
      'Driving at a constant speed on a motorway to improve fuel economy',
      'Using cruise control on a downhill gradient',
    ],
    correctIndex: 1,
    explanation:
      'Coasting means travelling with the clutch depressed or the gear selector in neutral, allowing the vehicle to roll freely. This reduces engine braking, meaning you rely entirely on the footbrake to slow down, and can make speed control on hills more difficult. The Highway Code advises against coasting.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_017',
    questionText: 'Your traction control light illuminates while you are driving. What does this indicate?',
    options: [
      'The traction control system has a fault and must be repaired immediately',
      'The driven wheels have begun to spin and the system is intervening to restore grip',
      'Your tyre pressures are too low and the car is losing grip',
      'You need to slow down because the road ahead is slippery',
    ],
    correctIndex: 1,
    explanation:
      'When the traction control warning light flashes, it means the system has detected wheel spin and is applying brakes or reducing engine power to restore traction. If the light stays on permanently (not flashing), there may be a system fault. Reduce speed and adapt your driving to the conditions.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_018',
    questionText: 'What is the key difference between oversteer and understeer?',
    options: [
      'Oversteer affects front-wheel-drive cars, understeer affects rear-wheel-drive cars',
      'Understeer is when the front slides wide in a corner; oversteer is when the rear slides out',
      'Oversteer is too much steering input; understeer is too little',
      'Understeer occurs when braking; oversteer occurs when accelerating on straight roads',
    ],
    correctIndex: 1,
    explanation:
      'Understeer is when the front tyres lose grip in a corner and the car goes straight on (or wider) despite turning the wheel. Oversteer is when the rear loses grip and swings out. Understeer is common in front-wheel-drive cars; oversteer is more common in rear-wheel-drive cars.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_019',
    questionText: 'Your front wheels begin to skid (understeer) in a corner. What is the correct response?',
    options: [
      'Turn the steering wheel further into the corner to force the tyres to grip',
      'Ease off the accelerator and reduce your steering input to allow the front tyres to regain grip',
      'Apply the handbrake gently to help rotate the car into the corner',
      'Brake hard to transfer weight to the front and restore front tyre grip',
    ],
    correctIndex: 1,
    explanation:
      'In an understeer situation (front slides wide), ease off the throttle smoothly and slightly reduce the steering lock. This allows weight to transfer forward, increases front tyre grip, and helps the car turn. Braking hard or increasing steering input makes understeer worse.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_020',
    questionText: 'Why should you slow down when driving on a gravel or loose surface road?',
    options: [
      'Loose surfaces attract more wildlife that may run into the road',
      'Tyres have reduced grip on loose surfaces, increasing braking distances and the risk of skidding',
      'Vehicle suspensions can be damaged by the uneven texture of gravel',
      'Loose surfaces reduce steering efficiency on modern power-steered vehicles',
    ],
    correctIndex: 1,
    explanation:
      'Gravel and loose surfaces significantly reduce tyre grip, making braking distances longer and skids more likely. Smooth, gentle inputs are especially important. Gravel flicked up by tyres can also cause damage to your own or following vehicles.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_021',
    questionText: 'You experience a sudden tyre blowout at speed on a motorway. What should you do?',
    options: [
      'Brake immediately as hard as possible and steer to the hard shoulder',
      'Hold the steering wheel firmly, ease off the accelerator gradually, and steer gently to the left',
      'Apply the handbrake to help slow the vehicle more quickly',
      'Increase your grip on the steering wheel and brake gently using the footbrake only',
    ],
    correctIndex: 1,
    explanation:
      'In a blowout, the vehicle may pull strongly toward the affected tyre. Grip the steering wheel firmly with both hands, keep the vehicle going straight if possible, ease off the throttle gently, and allow the car to slow naturally before steering carefully to a safe stop. Sudden braking can cause a loss of control.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_022',
    questionText: 'What is the recommended technique for performing a hill start on a manual vehicle without rolling back?',
    options: [
      'Apply the footbrake, select first gear, then release the footbrake while pressing the accelerator hard',
      'Use the handbrake, find the clutch biting point, apply some throttle, then release the handbrake',
      'Select second gear and pull away quickly to avoid wheel spin on the incline',
      'Keep the footbrake pressed and release the clutch slowly until the car creeps forward',
    ],
    correctIndex: 1,
    explanation:
      'Apply the handbrake to hold the vehicle. Select first gear and slowly raise the clutch to the biting point (you\'ll feel the engine note change). Apply a little throttle. Then release the handbrake as you continue to bring the clutch up. This prevents the vehicle from rolling back.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_023',
    questionText: 'When reversing a vehicle with a trailer, which way should you steer to move the trailer to the right?',
    options: [
      'Steer to the right - the trailer follows the same direction as your steering',
      'Steer to the left - this pushes the trailer to the right',
      'The trailer always goes in the opposite direction to the car',
      'Steer to the right initially, then quickly countersteer left to correct',
    ],
    correctIndex: 1,
    explanation:
      'When reversing with a trailer, steering inputs are reversed compared to reversing without one. To move the trailer to the right, you steer the car to the left. Use small, gentle steering inputs and check all mirrors frequently. Practice in an open area before attempting complex manoeuvres.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_024',
    questionText: 'Your vehicle begins to sway from side to side when towing a caravan. What is this called and what should you do?',
    options: [
      'Resonance - reduce speed gradually and avoid sudden movements',
      'Snaking or "snaking instability" - ease off the throttle gently and hold the steering straight',
      'Caravan yaw - apply the caravan\'s brakes independently to stop the swaying',
      'Trailer shimmy - brake hard to separate the car from the swaying caravan',
    ],
    correctIndex: 1,
    explanation:
      'Caravan snaking (or sway) is a dangerous oscillation that can overturn both car and caravan. Ease off the accelerator gradually - do not brake hard or steer sharply. Allow speed to reduce naturally until the swaying stops. Snaking is often caused by excessive speed, an unbalanced load, or crosswinds.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_025',
    questionText: 'Your car has Electronic Stability Control (ESC). How does it help during cornering?',
    options: [
      'It steers the car automatically to keep it on the correct line through a bend',
      'It detects loss of control and applies braking to individual wheels to help the driver maintain intended direction',
      'It adjusts tyre pressure automatically when grip is reduced',
      'It reduces steering assistance to give the driver more feedback on grip levels',
    ],
    correctIndex: 1,
    explanation:
      'Electronic Stability Control monitors vehicle behaviour and compares it to the driver\'s intended direction. If it detects a slide or loss of control, it can apply braking to individual wheels to help stabilise the vehicle. ESC significantly reduces the risk of rollovers and spin-outs but does not replace careful, appropriate driving.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_026',
    questionText: 'You are driving in thick fog. How should you adjust your speed?',
    options: [
      'Maintain your normal speed but increase following distance to 4 seconds',
      'Reduce speed to a level at which you can stop within the distance you can see clearly',
      'Stay at 40mph as this is the recommended speed for all fog conditions',
      'Increase speed slightly to reduce the time spent in dangerous conditions',
    ],
    correctIndex: 1,
    explanation:
      'In fog, reduce speed so that you can stop within the distance you can see ahead. This is the fundamental rule. If visibility is very poor, you may need to travel at walking pace. Never use fog as an excuse to drive at a dangerously slow speed in clear sections, but match speed to actual visibility at all times.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_027',
    questionText: 'What effect does carrying heavy luggage in the boot have on your vehicle\'s handling?',
    options: [
      'It improves rear traction in wet conditions',
      'It transfers weight rearward, affecting steering responsiveness and braking distances',
      'It reduces aerodynamic drag by lowering the rear of the vehicle',
      'It has no significant effect if the weight is within the vehicle\'s payload limit',
    ],
    correctIndex: 1,
    explanation:
      'A heavily loaded boot transfers weight to the rear, which can affect steering feel (reduced front tyre grip), increase braking distances, and reduce headlight effectiveness (they point upward). Adjust your headlights and speed accordingly. Always stay within the vehicle\'s maximum load rating.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_028',
    questionText: 'What is regenerative braking, and in which vehicles is it most commonly found?',
    options: [
      'A braking system that cools brake discs using airflow, found on sports cars',
      'A system that recovers kinetic energy during braking and stores it as electricity, used in hybrid and electric vehicles',
      'An automatic brake adjustment system found in modern diesel vehicles',
      'Emergency braking assistance triggered by forward-facing cameras',
    ],
    correctIndex: 1,
    explanation:
      'Regenerative braking is a feature of electric and hybrid vehicles. When the driver lifts off the throttle or applies the brakes, the electric motor acts as a generator, converting the vehicle\'s kinetic energy into electricity that charges the battery. This increases range and reduces wear on traditional brake components.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_029',
    questionText: 'You notice a strong knocking noise from the engine that gets worse under acceleration. What should you do?',
    options: [
      'Check the radio volume - it may just be interference from the audio system',
      'Stop driving as soon as safely possible and seek mechanical assistance',
      'Switch to a lower gear to reduce the load on the engine',
      'Add engine oil immediately - knocking always indicates low oil',
    ],
    correctIndex: 1,
    explanation:
      'A persistent knocking sound from the engine, especially under load, typically indicates a serious mechanical problem such as worn big-end bearings or low oil pressure. Continuing to drive can cause catastrophic engine damage. Stop safely and seek professional assistance rather than driving on.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_030',
    questionText: 'When driving long distances on a motorway at night, how can you stay alert?',
    options: [
      'Open a window and let cold air in to stay awake',
      'Play loud music to keep your mind active',
      'Plan for regular breaks at service stations and stop to rest if you feel tired',
      'Drink an extra coffee just before each 100-mile stretch',
    ],
    correctIndex: 2,
    explanation:
      'The only effective remedy for tiredness is sleep. On long motorway journeys, plan regular breaks every 2 hours. If you feel sleepy, stop at the next services for at least 15 minutes. Opening windows and loud music provide only very temporary relief and should not substitute for proper rest.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_031',
    questionText: 'What is the hypnotic effect associated with driving on motorways?',
    options: [
      'The disorientation caused by high-speed driving affecting the inner ear',
      'The drowsy, trance-like state induced by the unchanging motorway environment and constant engine noise',
      'Temporary night blindness caused by oncoming headlights at motorway speeds',
      'Over-reliance on cruise control that dulls the driver\'s awareness',
    ],
    correctIndex: 1,
    explanation:
      'The monotonous nature of motorway driving - constant speed, unchanging scenery, and the drone of the engine - can induce a drowsy, trance-like state. Drivers may not realise how impaired they have become. Take regular breaks and be aware that long spells of motorway driving require planned rest stops.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_032',
    questionText: 'When driving in very bright sunlight that is causing glare, what should you do?',
    options: [
      'Close your eyes briefly to rest them from the glare',
      'Use sunglasses and your sun visor to reduce glare, and reduce speed if visibility is seriously reduced',
      'Turn your headlights on full beam to help others see you',
      'Drive faster to get out of the sunlit area quickly',
    ],
    correctIndex: 1,
    explanation:
      'Sun glare can temporarily blind a driver, particularly when driving into a low sun. Use your sun visor and polarised sunglasses to reduce glare. Reduce speed if your vision is seriously impaired. Remember that your own vehicle may be harder to see by oncoming drivers in similar conditions.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_033',
    questionText: 'How does your vehicle\'s steering response change if the power steering fails?',
    options: [
      'The steering locks and the vehicle cannot be turned until the engine is restarted',
      'Steering becomes much heavier and requires significantly more physical effort to turn the wheel',
      'The steering becomes extremely light and over-sensitive',
      'Power steering failure has no effect on manual steering backup systems',
    ],
    correctIndex: 1,
    explanation:
      'If power steering fails, the steering wheel becomes very heavy and difficult to turn, particularly at low speeds or when manoeuvring. You can still steer the vehicle, but it requires much greater effort. Slow down and drive to a place of safety as soon as possible to have it checked.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_034',
    questionText: 'What is the risk of driving through a deep water splash at speed?',
    options: [
      'The water may freeze on cold brake components causing brake fade',
      'The sudden water resistance can cause aquaplaning, loss of control, and can flood the engine',
      'The water will remove road grime from the tyres and temporarily increase grip',
      'High-speed water impact always causes immediate tyre deflation',
    ],
    correctIndex: 1,
    explanation:
      'Driving fast through standing water or a deep puddle can cause aquaplaning, sudden loss of control, and the water can be forced into the engine air intake, potentially causing serious engine damage (water ingestion/hydrolocking). Always slow right down before driving through water of unknown depth.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_035',
    questionText: 'You are descending a steep hill with a heavy load. Which technique best controls your speed?',
    options: [
      'Press the brakes firmly and hold them continuously throughout the descent',
      'Select a lower gear before the descent to use engine braking, supplementing with the footbrake as needed',
      'Select neutral to save fuel and use only the footbrake',
      'Use the handbrake intermittently to rest the footbrake',
    ],
    correctIndex: 1,
    explanation:
      'On a long or steep descent, select a low gear before starting the descent and use engine braking to control your speed. Use the footbrake to supplement if needed, but avoid prolonged braking which leads to brake fade. The handbrake should never be applied at speed as it may lock the rear wheels.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_036',
    questionText: 'In an automatic transmission vehicle, when is it appropriate to select a lower gear manually?',
    options: [
      'When you want to slow down in any situation instead of using the footbrake',
      'On steep descents to provide engine braking and prevent the transmission from continuously hunting between gears',
      'Never - the automatic gearbox always selects the optimal gear',
      'Only when towing to prevent the gearbox from overheating',
    ],
    correctIndex: 1,
    explanation:
      'Many automatic vehicles allow manual gear selection. On steep descents, selecting a lower gear provides engine braking and prevents the gearbox from cycling between gears (hunting). This reduces heat build-up in the brakes and gives better speed control. Use this in exactly the same way as engine braking in a manual vehicle.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_037',
    questionText: 'What is the safest way to reduce speed when approaching a bend on an icy road?',
    options: [
      'Apply the brakes steadily while gently turning the wheel',
      'Brake in a straight line well before the bend, then release the brakes and steer gently through',
      'Select neutral to coast into the bend, applying brakes only if you go too wide',
      'Steer into the bend and apply brakes if you feel the tyres sliding',
    ],
    correctIndex: 1,
    explanation:
      'On ice, any combination of heavy steering input and braking is likely to cause a skid. Reduce speed while the vehicle is still going straight - use gentle, progressive braking. Once you are at the right speed, release the brakes and steer gently through the bend. Smoothness and planning ahead are essential.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_038',
    questionText: 'How does an overloaded vehicle affect its braking performance?',
    options: [
      'Extra weight improves tyre grip and actually reduces stopping distances',
      'An overloaded vehicle takes longer to stop because the additional mass requires more force to decelerate',
      'Overloading has no significant effect on braking in modern vehicles with ABS',
      'Overloading reduces braking distance because the tyres are pressed harder against the road',
    ],
    correctIndex: 1,
    explanation:
      'Newton\'s second law: a heavier vehicle requires more force to decelerate at the same rate. An overloaded vehicle has significantly longer stopping distances. Brakes, tyres, and suspension are also stressed beyond their design limits. Always stay within the vehicle\'s maximum authorised mass (MAM).',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_039',
    questionText: 'What does it mean when your vehicle\'s brake warning light stays on after starting the engine?',
    options: [
      'The brake pads need to be lubricated - this is routine maintenance',
      'There is a fault with the braking system - have it checked before driving',
      'The handbrake reminder light - release the handbrake to cancel it',
      'This is normal during cold weather until the brakes warm up',
    ],
    correctIndex: 1,
    explanation:
      'If the brake warning light remains on after releasing the handbrake, it indicates a potential fault in the braking system - this could be low brake fluid, a hydraulic fault, or worn pads triggering a sensor. This is a safety-critical warning - do not ignore it and have the vehicle inspected before driving further.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_040',
    questionText: 'You are driving on a wet road at 60mph. How much longer is your stopping distance compared to dry conditions?',
    options: [
      'Twice as long',
      'The same - ABS prevents any difference',
      'About one-third longer',
      'Four times as long',
    ],
    correctIndex: 0,
    explanation:
      'In wet conditions, stopping distances are approximately double those in dry conditions. At 60mph, the Highway Code quotes a dry stopping distance of 73 metres. In wet conditions this can exceed 140 metres. Reduce speed and increase following distances significantly in rain.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_041',
    questionText: 'What is the purpose of anti-lock brakes (ABS) during emergency braking?',
    options: [
      'ABS removes the need to steer during emergency stops - the car stops automatically in a straight line',
      'ABS prevents the wheels from locking, allowing the driver to maintain steering control while braking hard',
      'ABS reduces stopping distances to half of those of a non-ABS vehicle',
      'ABS automatically applies the correct braking force without any input from the driver',
    ],
    correctIndex: 1,
    explanation:
      'ABS prevents wheel lock-up during hard braking, which would otherwise cause a loss of steering control. With ABS, you can steer around an obstacle while braking hard. Apply firm, continuous pressure to the brake pedal - do not pump it. ABS reduces the risk of losing control but does not necessarily shorten stopping distances.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_042',
    questionText: 'You feel your steering becoming progressively lighter and the vehicle harder to keep straight on a motorway. What is the most likely cause?',
    options: [
      'The tyres are overinflated and providing less contact patch with the road',
      'Aquaplaning - the tyres are riding on a film of water and losing contact with the road surface',
      'A front tyre blowout causing loss of pressure',
      'Crosswind pushing the vehicle from one side',
    ],
    correctIndex: 1,
    explanation:
      'If steering becomes very light and the vehicle tends to drift, aquaplaning is likely. The tyres have risen onto a film of water and lost contact with the road surface. Ease gently off the accelerator, keep the steering straight, and wait for the tyres to regain grip as speed reduces. Do not brake sharply.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_043',
    questionText: 'What is the effect on tyre grip when driving on a road with a diesel or oil spillage?',
    options: [
      'Diesel acts as a lubricant between the tyre and road, dramatically reducing grip',
      'Oil improves tyre grip by filling in rough road surface texture',
      'Modern tyres have compounds designed to grip oil-contaminated surfaces',
      'Diesel only affects grip at speeds above 50mph',
    ],
    correctIndex: 0,
    explanation:
      'Diesel and oil create an extremely slippery surface that can dramatically reduce tyre grip, especially in wet conditions. Stopping distances can increase enormously. If you see oil or diesel on the road (often indicated by rainbow sheen), slow right down and avoid harsh braking or steering inputs.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_044',
    questionText: 'When should you switch from dipped headlights to full beam on a rural road at night?',
    options: [
      'Whenever you are travelling above 40mph on an unlit road',
      'Only when the road ahead is completely clear of other road users and there is no oncoming traffic',
      'Whenever visibility is reduced, regardless of other road users',
      'Full beam should be used by default on all rural roads after dark',
    ],
    correctIndex: 1,
    explanation:
      'Use full beam when there is no oncoming traffic and no vehicle ahead of you that might be dazzled. Switch to dipped headlights as soon as you see oncoming lights or approach a vehicle from behind. Full beam on approaching traffic is dangerous and illegal as it dazzles other drivers.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 1,
  },
  {
    id: 'VHN_045',
    questionText: 'Your vehicle is fitted with cruise control. In what conditions should you not use it?',
    options: [
      'On dual carriageways, as variable speeds are needed',
      'In heavy rain, fog, ice, or congested traffic where speed needs to vary constantly',
      'At night, as the driver may fall asleep more easily at constant speed',
      'When there are more than two passengers in the vehicle',
    ],
    correctIndex: 1,
    explanation:
      'Cruise control should not be used in adverse weather (rain, ice, fog), heavy traffic, or on winding roads where speed needs to be adjusted frequently. In these conditions, you need full manual control to respond to rapidly changing situations. Using cruise control on a wet road can increase aquaplaning risk.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_046',
    questionText: 'What is the effect of under-inflated tyres on fuel consumption and handling?',
    options: [
      'Under-inflation improves grip and reduces fuel consumption',
      'Under-inflation increases rolling resistance, raises fuel consumption, and makes handling less responsive',
      'Under-inflation has minimal effect on handling but increases tyre noise',
      'Under-inflation only affects fuel consumption in vehicles over 2.5 tonnes',
    ],
    correctIndex: 1,
    explanation:
      'Under-inflated tyres have a larger contact patch and increased rolling resistance, meaning the engine must work harder and uses more fuel. Handling becomes sluggish, braking distances increase, and the tyre can overheat and fail. Check tyre pressures regularly - at least once a month and before long journeys.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_047',
    questionText: 'What is meant by the "limit point" of a bend when applied to safe cornering?',
    options: [
      'The maximum speed at which the bend can be taken without losing control',
      'The furthest visible point on the road that you can see around the bend - used to judge safe speed',
      'The point at which you should apply the brakes before entering a bend',
      'The innermost point of a bend where vehicles are most likely to cross the centre line',
    ],
    correctIndex: 1,
    explanation:
      'The limit point is the furthest point of the road that you can see ahead around a bend. If it is moving away from you, the bend is opening and you can maintain or increase speed. If it is moving toward you, the bend is tightening and you should reduce speed. Using the limit point is a key advanced driving technique.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_048',
    questionText: 'What should you do if you feel a strong pull on the steering wheel to one side while driving at normal speed?',
    options: [
      'Fight the pull with the steering wheel and continue to your destination',
      'Reduce speed gradually and pull over safely - the cause (possible tyre fault or brake issue) must be investigated',
      'Adjust your speed until the pull feels less severe',
      'This is normal in crosswind conditions and no action is needed',
    ],
    correctIndex: 1,
    explanation:
      'A sudden or strong pull to one side while driving can indicate a tyre failure, brake fault, or steering problem. These are safety-critical conditions. Do not fight the pull or drive on hoping it will resolve. Slow down gradually and safely and pull over to investigate.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 2,
  },
  {
    id: 'VHN_049',
    questionText: 'How does four-wheel drive (4WD) help in slippery conditions, and what are its limitations?',
    options: [
      '4WD improves traction when moving off but provides the same braking distance as a 2WD vehicle',
      '4WD reduces both stopping distances and the risk of skidding in all conditions',
      '4WD gives complete immunity from skidding on snow and ice',
      '4WD is only beneficial on mud and has no advantage in snow or rain',
    ],
    correctIndex: 0,
    explanation:
      '4WD significantly improves traction when pulling away or climbing in slippery conditions by distributing drive to all four wheels. However, once moving, braking distances are not shorter than a 2WD vehicle - the same physics applies. Drivers of 4WD vehicles sometimes over-estimate their ability to stop on ice or snow.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
  {
    id: 'VHN_050',
    questionText: 'You have to make an emergency stop. What is the correct technique in a vehicle without ABS?',
    options: [
      'Apply maximum brake pressure immediately and hold it until stopped',
      'Apply firm progressive brake pressure to the point just before the wheels lock, easing off if they lock',
      'Pump the brake pedal rapidly to prevent wheel lock',
      'Apply the footbrake and handbrake simultaneously for maximum stopping force',
    ],
    correctIndex: 1,
    explanation:
      'Without ABS, apply firm, progressive pressure - squeeze the brake pedal firmly and progressively, but ease off slightly if you feel the wheels beginning to lock (evidenced by the car pulling, skidding noise, or loss of steering). If wheels do lock, ease the pressure briefly to restore grip, then reapply. In a vehicle with ABS, apply and hold firm, continuous pressure.',
    topicCategory: TopicCategory.VehicleHandling,
    difficulty: 3,
  },
];
