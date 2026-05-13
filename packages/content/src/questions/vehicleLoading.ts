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
  {
    id: 'VLD_016',
    questionText: 'The "85% rule" in caravanning refers to what?',
    options: [
      'The caravan load should not exceed 85% of the manufacturer\'s maximum loading limit',
      'The caravan\'s maximum authorised mass (MAM) should not exceed 85% of the towing vehicle\'s kerbweight',
      'At least 85% of the caravan\'s weight must be over the axle',
      'Speed must be reduced by 85% compared to the national speed limit',
    ],
    correctIndex: 1,
    explanation:
      'The 85% rule recommends that the maximum authorised mass (MAM) of the caravan should not exceed 85% of the towing vehicle\'s kerbweight. Exceeding this ratio significantly increases the risk of snaking and loss of control, particularly for less experienced towers.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_017',
    questionText: 'When is it a legal requirement to fit extended towing mirrors?',
    options: [
      'Only when towing on motorways',
      'When the towed vehicle or load is wider than the towing vehicle, blocking the normal rear view',
      'Only when the trailer exceeds 750kg maximum authorised mass',
      'Extended mirrors are advisory only and are never a legal requirement',
    ],
    correctIndex: 1,
    explanation:
      'The law requires that the driver has an adequate field of rear vision. If a caravan or trailer is wider than the towing vehicle and obstructs the view through the standard door mirrors, extended towing mirrors must be fitted. Driving with an inadequate view behind is an offence.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_018',
    questionText: 'What is a trailer breakaway cable, and why is it required?',
    options: [
      'A cable that stops the trailer brakes overheating on long descents',
      'A cable attached between the trailer and towing vehicle that applies the trailer\'s brakes if the trailer becomes detached',
      'A cable that limits the maximum turning angle of the trailer coupling',
      'A safety cable that prevents the trailer from rolling over on bends',
    ],
    correctIndex: 1,
    explanation:
      'A breakaway cable connects the trailer to the towing vehicle and is designed to apply the trailer\'s brakes automatically if the trailer becomes accidentally uncoupled. This prevents a runaway trailer. It is a legal requirement for trailers with their own braking system.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_019',
    questionText: 'What is the legal consequence for a driver whose unsecured load falls from their vehicle and injures another road user?',
    options: [
      'The driver is not liable as the load manufacturer bears responsibility for packaging',
      'The driver may face prosecution for driving without due care and attention, and civil liability for any damages',
      'The driver receives a warning but no points on their licence',
      'Only the vehicle operator, not the driver, is legally responsible for load security',
    ],
    correctIndex: 1,
    explanation:
      'A driver who allows an unsecured load to fall from their vehicle can be prosecuted for driving without due care and attention or dangerous driving. This can result in penalty points, fines, and in serious cases, imprisonment. Civil liability for injuries or damage caused also falls on the driver and operator.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_020',
    questionText: 'How does carrying a heavy load affect tyre pressures and what adjustment is needed?',
    options: [
      'Heavy loads reduce tyre temperatures so pressures should be reduced',
      'Tyres should be inflated to the higher end of the manufacturer\'s recommended range when carrying heavy loads',
      'Tyre pressures are unaffected by load and no adjustment is needed',
      'Only rear tyre pressures need adjustment for heavy loads',
    ],
    correctIndex: 1,
    explanation:
      'Most vehicle manufacturers specify increased tyre pressures for heavy loading. Check the vehicle handbook or the tyre placard (usually inside the driver\'s door) for the correct pressures at full load. Under-inflated tyres under heavy load generate excessive heat, increasing the risk of tyre failure.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_021',
    questionText: 'What does "payload" mean in the context of vehicle loading?',
    options: [
      'The total weight of the vehicle including the driver only',
      'The maximum weight of cargo (including passengers) that can legally be carried, calculated as MAM minus kerbweight',
      'The maximum weight of a trailer the vehicle can tow',
      'The weight of fuel and fluids required for a full journey',
    ],
    correctIndex: 1,
    explanation:
      'Payload is the maximum weight of cargo, passengers, and luggage that a vehicle can legally carry. It is calculated by subtracting the vehicle\'s kerbweight (empty vehicle with full fuel) from its Maximum Authorised Mass (MAM). Exceeding the payload is illegal and dangerous.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_022',
    questionText: 'Why should the heaviest items be loaded as close to the trailer\'s axle as possible?',
    options: [
      'To reduce the overall height of the load and improve aerodynamics',
      'To minimise noseweight and tailweight fluctuations that cause sway and instability',
      'To reduce the load on the towing vehicle\'s gearbox',
      'Heavy items near the axle have no particular advantage over any other position',
    ],
    correctIndex: 1,
    explanation:
      'Placing heavy items over or near the trailer\'s axle minimises the lever-arm effect that causes excessive noseweight or tailweight. A correctly balanced trailer has appropriate noseweight, is stable at speed, and puts acceptable loads on the towing vehicle\'s rear axle and towball.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_023',
    questionText: 'How does carrying a full load affect your vehicle\'s headlight aim?',
    options: [
      'Headlights aim upward when the vehicle is heavily loaded, potentially dazzling oncoming drivers',
      'Headlights aim downward when heavily loaded, reducing visibility ahead',
      'A full load has no effect on headlight aim in modern vehicles',
      'Headlights automatically adjust for load on all post-2010 vehicles',
    ],
    correctIndex: 0,
    explanation:
      'A heavy rear load causes the back of the vehicle to sit lower, tilting the front upward. This directs the headlight beams higher, potentially dazzling oncoming drivers. Many vehicles have a headlight levelling control that must be adjusted for loading. Check your vehicle handbook for the correct setting.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_024',
    questionText: 'What width restriction applies to loads on a vehicle before additional markers or police notification is required?',
    options: [
      'Loads exceeding 2.0 metres wide require a marker board',
      'Loads exceeding 2.9 metres wide require official notification',
      'Loads exceeding 2.55 metres wide are automatically classified as abnormal',
      'No restrictions apply to vehicle width unless the load exceeds 4 metres',
    ],
    correctIndex: 1,
    explanation:
      'Loads wider than 2.9 metres require advance notification to the police and highway authorities. Loads wider than 3.5 metres require a police escort. For loads between 2.55m and 2.9m, marker boards are required. Always check current regulations as specific limits may vary by load type.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_025',
    questionText: 'What is a "stabiliser hitch" for a caravan, and does it eliminate the risk of sway?',
    options: [
      'It eliminates sway completely and allows higher towing speeds',
      'It reduces the tendency to sway but does not eliminate it - correct loading and speed are still essential',
      'It is a braking system that activates when the caravan begins to oscillate',
      'It is only required for caravans wider than 2.1 metres',
    ],
    correctIndex: 1,
    explanation:
      'A caravan stabiliser (such as a friction stabiliser or electronic sway control) reduces the onset of snaking and can help damp oscillations. However, it does not eliminate the risk of sway. Correct loading (appropriate noseweight, 85% rule), speed management, and good vehicle/caravan matching remain essential.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_026',
    questionText: 'You are loading a van for a long journey. What is the priority when deciding where to place items?',
    options: [
      'Place fragile items first so they can be protected by heavier items on top',
      'Secure all items so they cannot move in transit, with heavy items low and forward and lighter items on top',
      'Stack items as high as possible to use all available space',
      'Load the heaviest items last so they are the easiest to remove first',
    ],
    correctIndex: 1,
    explanation:
      'All items must be secured so they cannot shift in transit. Heavy items should be placed low and as far forward as practical. Use straps, nets, or load bars to prevent movement. Shifting loads in a van change the vehicle\'s handling unpredictably and become dangerous projectiles in an emergency stop.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_027',
    questionText: 'What extra checks should you make to your mirrors before driving with a roof rack load?',
    options: [
      'No additional checks are needed - roof racks do not affect mirror views',
      'Check that the load does not obstruct the interior mirror\'s view of the rear window',
      'Only the door mirrors need checking as the interior mirror view is unaffected by roof loads',
      'Replace the interior mirror with an external camera system',
    ],
    correctIndex: 1,
    explanation:
      'A high or wide roof rack load can obstruct the view through the interior rear-view mirror. Check before setting off that you have an adequate view of the road behind. If the interior mirror is obstructed, rely on well-adjusted door mirrors and consider whether the load can be rearranged.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_028',
    questionText: 'How should bicycles be mounted on a rear bike rack to be legal and safe?',
    options: [
      'Any arrangement is acceptable as long as the bikes are tied on',
      'The rack must not obscure the number plate or rear lights, and bikes must be secured to the rack with straps or clamps',
      'Bikes must be transported inside the vehicle only - external racks are not legal',
      'Only one bicycle may be carried on an external rack',
    ],
    correctIndex: 1,
    explanation:
      'A rear bike rack must not obscure the registration plate or any rear lights. If the plate is hidden, a supplementary plate must be fitted to the rack. Bikes must be securely fastened. The total combination must not exceed the vehicle\'s MAM and the rack\'s weight rating.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_029',
    questionText: 'What is the maximum speed on a motorway for a vehicle towing a caravan?',
    options: [
      '50mph',
      '55mph',
      '60mph',
      '70mph',
    ],
    correctIndex: 2,
    explanation:
      'A car towing a caravan is limited to 60mph on a motorway. This is lower than the 70mph national limit for cars. The lower limit reflects the increased instability risk of towing and the longer stopping distances. The same 60mph limit applies on dual carriageways.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_030',
    questionText: 'During an emergency stop with a heavy, unsecured load in the boot, what can happen?',
    options: [
      'The weight at the rear helps to stop the vehicle faster',
      'Loose items can fly forward with significant force, injuring front-seat occupants',
      'The ABS compensates for the extra weight automatically',
      'The load shifts to the rear, helping to press the rear wheels down',
    ],
    correctIndex: 1,
    explanation:
      'In an emergency stop, everything in the vehicle continues forward at the original speed due to inertia. Loose heavy objects become dangerous high-speed projectiles capable of causing fatal injuries to occupants. Always secure loads, even for short journeys.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_031',
    questionText: 'What is the recommended procedure before undertaking a long journey with heavy luggage or a full passenger load?',
    options: [
      'Drive a short test route at 20mph to check for any unusual handling',
      'Check and adjust tyre pressures, headlight aim, and braking distances before setting off',
      'No specific checks are needed - modern vehicles handle any load within MAM automatically',
      'Check only the fuel level and the tyre tread depth',
    ],
    correctIndex: 1,
    explanation:
      'Before a loaded long journey: check tyre pressures (increase for heavy loads as per the handbook), adjust headlight aim if a levelling control is fitted, allow for longer braking distances and adjust your following distance accordingly. These simple steps significantly improve safety.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_032',
    questionText: 'A long ladder is being carried on a van roof rack. What hazard does this present to following traffic?',
    options: [
      'No hazard - the ladder is on the roof and cannot affect following traffic',
      'If the ladder is not secured properly, it could slide or fall and cause a serious collision',
      'The ladder increases the van\'s wind resistance, making it difficult to stop in time',
      'The ladder may strike low bridges if the driver misjudges height',
    ],
    correctIndex: 1,
    explanation:
      'Unsecured items on a roof rack, including ladders, can slide rearward or fall off if not properly restrained. A falling ladder at motorway speeds would be a catastrophic hazard to following traffic. Use proper roof rack clamps, straps, and check the load before every journey.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_033',
    questionText: 'When carrying animals in a vehicle, what additional consideration applies to load and handling?',
    options: [
      'Animals are not legally considered a "load" and have no impact on the vehicle\'s MAM',
      'Animals shift position and can affect handling - they must be safely restrained to prevent sudden weight transfer',
      'Animals must always travel in the boot to keep weight distribution balanced',
      'The weight of animals is automatically excluded from payload calculations',
    ],
    correctIndex: 1,
    explanation:
      'Animals moving freely inside a vehicle change the weight distribution unpredictably and can distract or physically obstruct the driver. Legally, animals are included in the vehicle\'s total weight. Larger animals must be restrained or caged. An unrestrained dog in a vehicle can also be a driving offence under the Road Traffic Act.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_034',
    questionText: 'How does a heavy load change the way you should corner?',
    options: [
      'You can corner faster as the extra weight improves tyre grip',
      'Reduce cornering speed and allow more space, as a heavy load raises the centre of gravity and can cause rollover or oversteer',
      'Corner at normal speed but increase throttle to maintain momentum through the bend',
      'A heavy load only affects braking, not cornering',
    ],
    correctIndex: 1,
    explanation:
      'A heavier load raises the centre of gravity (especially with roof loads) and can cause the vehicle to roll or understeer in corners. Reduce speed before bends, apply smooth steering inputs, and allow more space for cornering. Vans and high-sided vehicles are particularly susceptible when loaded.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_035',
    questionText: 'What should you do if you find your load has shifted during a journey?',
    options: [
      'Continue at reduced speed and re-secure at your destination',
      'Stop in a safe place as soon as possible and re-secure the load before continuing',
      'Alert following vehicles by switching on your hazard lights while driving',
      'Only stop if the vehicle is handling noticeably differently',
    ],
    correctIndex: 1,
    explanation:
      'A shifted load changes the vehicle\'s handling and may become an immediate hazard. Pull over in a safe location as soon as possible and re-secure it before continuing. Driving with an unsecured or shifted load is dangerous and could lead to prosecution if it falls from the vehicle.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_036',
    questionText: 'What is the effect of carrying a very light trailer behind a heavy towing vehicle?',
    options: [
      'A lighter trailer is always easier to manage - there are no additional risks',
      'A very light trailer can be subject to more sway and instability at speed than a correctly loaded one',
      'A light trailer reduces braking distances compared to no trailer',
      'A light trailer improves the towing vehicle\'s fuel economy',
    ],
    correctIndex: 1,
    explanation:
      'Counterintuitively, a very light (or empty) trailer can be more prone to snaking and instability than a correctly loaded one. The trailer lacks sufficient mass to track stably behind the towing vehicle. Ensure the trailer has some ballast or load over the axle, and adjust speed accordingly.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_037',
    questionText: 'What does it mean if a trailer has the words "MAX GROSS WEIGHT 2000 KG" on a plate?',
    options: [
      'The trailer weighs 2,000 kg when empty',
      'The combined weight of the trailer and its load must not exceed 2,000 kg',
      'The towing vehicle must weigh at least 2,000 kg to tow this trailer',
      'The trailer can carry a load of 2,000 kg in addition to its own weight',
    ],
    correctIndex: 1,
    explanation:
      'The gross weight plate on a trailer indicates the Maximum Authorised Mass (MAM) - the maximum total weight of the trailer including its own weight and all the load it is carrying. The load capacity is the MAM minus the trailer\'s own (unladen) weight.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_038',
    questionText: 'How should you adapt your driving style when your vehicle is heavily loaded on a long journey?',
    options: [
      'Drive at the speed limit throughout - the vehicle\'s safety systems compensate for the extra weight',
      'Allow longer stopping distances, accelerate and brake more gradually, and take corners at reduced speed',
      'Only the first 30 minutes require adapted driving, after which normal style is safe',
      'Avoid motorways as heavily loaded vehicles are prohibited in the outside lanes',
    ],
    correctIndex: 1,
    explanation:
      'A heavily loaded vehicle has longer braking distances, slower acceleration, and is more susceptible to instability in corners. Allow more following distance, use earlier and gentler braking, take corners more slowly, and increase your margins throughout. These adjustments reduce risk and improve vehicle control.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_039',
    questionText: 'A car is transporting a very tall load strapped to a roof rack. What risk should the driver be most aware of?',
    options: [
      'Reduced grip on the front tyres due to the extra weight directly above them',
      'Height restrictions at bridges, car parks, and level crossings',
      'Reduced fuel economy causing the fuel gauge to read incorrectly',
      'The load acting as a sail and improving motorway stability',
    ],
    correctIndex: 1,
    explanation:
      'A tall roof load significantly increases the vehicle\'s overall height. Drivers must check the height of any structures they plan to pass under - bridges, car park barriers, and level crossing structures. Many car parks and bridges have barriers at 2.0m or 2.1m that would be struck by a tall roof load.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_040',
    questionText: 'What is the minimum overhang distance at the rear of a vehicle before a marker must be displayed?',
    options: [
      '0.5 metres',
      '1 metre',
      '2 metres',
      '3 metres',
    ],
    correctIndex: 1,
    explanation:
      'A load that overhangs more than 1 metre beyond the rear of the vehicle must be marked. By day, a red flag or board; at night or in poor visibility, a red light or reflector is required. Overhangs beyond 2 metres may require police notification depending on total vehicle length.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_041',
    questionText: 'You are helping to load a lorry. The driver tells you they will overload it "just slightly" to save a second trip. What should you say?',
    options: [
      'It is fine to be slightly over the limit - enforcement checks are rare',
      'Overloading is illegal, dangerous, and invalidates the vehicle\'s insurance - the load must be reduced',
      'Only the driver is responsible, not the person loading, so there is no problem',
      'Agree only if the journey is short and on uncongested roads',
    ],
    correctIndex: 1,
    explanation:
      'Overloading is illegal regardless of the amount. It endangers other road users through compromised braking and handling, risks tyre failure, and can damage the road surface. Both the driver and operator can be prosecuted. Insurance may also be invalidated, meaning any collision costs must be borne personally.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_042',
    questionText: 'Which of the following correctly describes why carrying passengers reduces your available braking distance?',
    options: [
      'Passengers add weight, increasing inertia and requiring more distance to stop',
      'Passengers distract the driver, increasing reaction time',
      'Passengers shift the centre of gravity rearward, reducing front brake efficiency',
      'Passengers increase engine load, reducing available braking power',
    ],
    correctIndex: 0,
    explanation:
      'Newton\'s laws of motion dictate that more mass requires more force to decelerate at the same rate. Passengers add weight to the vehicle, increasing the total mass that needs to be slowed. This directly extends braking distances. Adapt your following distance accordingly when carrying a full passenger load.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_043',
    questionText: 'What is the purpose of using lashing straps or ratchet straps when loading a trailer or van?',
    options: [
      'To prevent the doors from opening during transit',
      'To secure the load and prevent it from shifting, sliding, or falling during transit',
      'To reduce the trailer\'s noseweight to the recommended level',
      'They are decorative and have no legal requirement behind their use',
    ],
    correctIndex: 1,
    explanation:
      'Lashing and ratchet straps are load restraint equipment. They hold cargo in place against the forces of acceleration, braking, and cornering. The law requires loads to be secured so that they cannot move or fall from the vehicle. Operators and drivers can be prosecuted for inadequate load restraint.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_044',
    questionText: 'How does an overloaded vehicle affect the roads it uses?',
    options: [
      'Overloaded vehicles only affect their own handling - roads are unaffected',
      'Heavy vehicles cause road surface damage and overloaded vehicles accelerate this damage, especially in hot weather when tarmac softens',
      'Modern road surfaces are designed to handle any vehicle weight without damage',
      'Road damage from overloaded vehicles is only significant on residential roads, not A-roads',
    ],
    correctIndex: 1,
    explanation:
      'Overloaded vehicles exert excessive force on road surfaces and bridges. This leads to accelerated road damage, cracking, and pothole formation. In hot weather, tarmac softens and heavier loads cause ruts. Overloaded heavy vehicles can also cause structural stress on bridges not designed for the excess weight.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_045',
    questionText: 'Which of the following loads would require a police escort in the UK?',
    options: [
      'A vehicle carrying a load that extends 1 metre beyond the rear',
      'A vehicle with a total width exceeding 3.5 metres',
      'A vehicle carrying a load that exceeds the vehicle\'s MAM by up to 10%',
      'Any commercial vehicle travelling on a motorway after midnight',
    ],
    correctIndex: 1,
    explanation:
      'In the UK, loads wider than 3.5 metres require a police escort as part of an abnormal load movement. Movements must also be pre-notified to highway authorities. Different rules apply for width, length, and height. Abnormal load movements are typically restricted to certain hours to minimise disruption.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_046',
    questionText: 'What is the effect of carrying a heavy roof load on a vehicle\'s fuel consumption?',
    options: [
      'Fuel consumption improves as the extra weight presses the tyres to the road',
      'Fuel consumption increases significantly due to additional aerodynamic drag and the extra weight',
      'Fuel consumption is unchanged as modern engines adjust output automatically',
      'Fuel consumption decreases slightly as the additional mass stores kinetic energy',
    ],
    correctIndex: 1,
    explanation:
      'A roof load increases fuel consumption in two ways: the extra weight requires more engine output to move and accelerate, and the additional height creates more aerodynamic drag (the "brick wall" effect). A roof box can increase fuel consumption by 10-25% at motorway speeds, even when empty.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_047',
    questionText: 'What should you do with a roof rack or roof box when it is not in use?',
    options: [
      'Leave it on permanently as it has no effect on fuel economy when empty',
      'Remove it when not needed to improve fuel economy and reduce wind noise',
      'Keep it fitted but remove any straps or fittings to reduce weight',
      'Cover it with a tarpaulin to reduce wind resistance',
    ],
    correctIndex: 1,
    explanation:
      'An empty roof rack or roof box still creates significant aerodynamic drag, increasing fuel consumption and wind noise. Remove it when not in use to save fuel and reduce running costs. Even an empty roof rack can increase fuel use by up to 10% at motorway speeds due to drag.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 1,
  },
  {
    id: 'VLD_048',
    questionText: 'A driver is asked to transport building waste in a van. What obligations do they have?',
    options: [
      'No specific obligations - any private individual can transport waste',
      'They may need a waste carrier\'s licence and must use authorised disposal sites - fly-tipping is a criminal offence',
      'They need only a standard driving licence with the correct category entitlement',
      'Commercial waste may be transported freely provided it stays under the vehicle\'s MAM',
    ],
    correctIndex: 1,
    explanation:
      'Transporting commercial waste (including building waste) for hire or reward requires a registered waste carrier licence from the Environment Agency. Waste must be taken to authorised disposal sites. Fly-tipping is a serious criminal offence with fines up to £50,000 or imprisonment.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
  {
    id: 'VLD_049',
    questionText: 'What is the main danger of carrying passengers or cargo that restricts the driver\'s view to the rear?',
    options: [
      'It is a cosmetic issue and has no effect on safety',
      'The driver cannot see vehicles approaching from behind, increasing the risk of a rear collision during reversing or lane changes',
      'The DVLA requires an additional mirror to be fitted when rear view is blocked',
      'The vehicle\'s reversing sensors will compensate and the camera view is unaffected',
    ],
    correctIndex: 1,
    explanation:
      'Losing the rear-view mirror view (whether from passengers, luggage, or cargo) removes a key source of information about following traffic. The driver must rely entirely on door mirrors. Reversing becomes particularly hazardous. Ensure loads do not obstruct rear vision, or reposition the load.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 2,
  },
  {
    id: 'VLD_050',
    questionText: 'You are loading a small trailer with two heavy items of equal weight. Where should you place them to achieve the best balance?',
    options: [
      'Both items at the rear of the trailer, as far from the towball as possible',
      'Both items at the front of the trailer, directly over the towball',
      'One item over the axle and one just forward of the axle, distributed evenly either side',
      'Stack both items on top of each other in the centre to keep them compact',
    ],
    correctIndex: 2,
    explanation:
      'Optimal trailer loading places weight over and just forward of the axle, evenly distributed either side of the centreline. This achieves the correct noseweight (some downward force on the towball) while avoiding excessive tailweight. Placing all weight at the rear creates insufficient noseweight and promotes sway.',
    topicCategory: TopicCategory.VehicleLoading,
    difficulty: 3,
  },
];
