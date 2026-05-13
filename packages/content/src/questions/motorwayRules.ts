// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const motorwayRulesQuestions: Question[] = [
  {
    id: 'MOT_001',
    questionText: 'What is the national speed limit on a UK motorway for a car?',
    options: [
      '60mph',
      '70mph',
      '80mph',
      '90mph',
    ],
    correctIndex: 1,
    explanation:
      'The national speed limit on a motorway for cars and motorcycles is 70mph. Variable speed limit signs may display lower limits, which are legally enforceable.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_002',
    questionText: 'Which lane should you use for normal driving on a motorway when the road ahead is clear?',
    options: [
      'The middle lane to maintain maximum safety',
      'Any lane - choose the one that suits your speed',
      'The left-hand lane',
      'The right-hand lane to stay out of the way of slower traffic',
    ],
    correctIndex: 2,
    explanation:
      'Rule 264 of the Highway Code states you must always drive in the left-hand lane when the road is clear. Other lanes are for overtaking only. Remaining in the middle lane unnecessarily is careless driving.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_003',
    questionText: 'What does a red X displayed on a motorway overhead gantry sign mean?',
    options: [
      'Slow down and use that lane with care',
      'That lane is closed - you must not drive in it',
      'A breakdown is ahead in that lane',
      'Reduce speed to 50mph in preparation for a junction',
    ],
    correctIndex: 1,
    explanation:
      'A red X means the lane is closed and you must not drive in it. Ignoring a red X is a criminal offence under the Road Traffic Act. Move to an open lane as soon as it is safe to do so.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_004',
    questionText: 'When joining a motorway from a slip road, who has priority?',
    options: [
      'Vehicles joining from the slip road, as they are accelerating to motorway speed',
      'Traffic already on the motorway',
      'Priority depends on the type of junction',
      'Whichever vehicle arrives at the merge point first',
    ],
    correctIndex: 1,
    explanation:
      'Traffic already on the motorway has priority. When joining from a slip road, you must match the speed of motorway traffic and merge safely into a gap in the left-hand lane. Do not force your way in or expect others to slow down.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_005',
    questionText: 'You break down on a motorway. Where should you stop and what should you do first?',
    options: [
      'Stop in the left lane and switch on hazard lights',
      'Pull onto the hard shoulder or emergency refuge area, exit via the nearside door, and move behind the barrier',
      'Coast to the next junction before stopping',
      'Stop on the hard shoulder and remain in the vehicle to await recovery',
    ],
    correctIndex: 1,
    explanation:
      'Pull as far left as possible onto the hard shoulder or emergency refuge area. Exit from the left (nearside) door and stand behind the barrier away from the carriageway. Call for recovery from an emergency phone or mobile. Never stand between your vehicle and live traffic.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_006',
    questionText: 'At what minimum distance should you leave a separation gap when travelling at 70mph on a motorway?',
    options: [
      'At least 35 metres (2 seconds)',
      'At least 96 metres (the two-second rule produces this at 70mph)',
      'At least 50 metres',
      'At least 175 metres',
    ],
    correctIndex: 1,
    explanation:
      'The two-second rule means you should maintain at least a two-second gap to the vehicle ahead. At 70mph this equates to approximately 96 metres. In wet conditions double this gap to at least four seconds.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_007',
    questionText: 'When may you use the right-hand lane of a three-lane motorway?',
    options: [
      'When travelling at or near the speed limit',
      'Only to overtake slower-moving vehicles, returning to the left when safe',
      'Whenever you prefer to avoid slower traffic in the left lane',
      'At any time, provided you stay within the speed limit',
    ],
    correctIndex: 1,
    explanation:
      'The right-hand lane is for overtaking only. Once you have passed the slower vehicle, you must move back to the left as soon as it is safe. Staying in the right lane when not overtaking is lane hogging and a careless driving offence.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_008',
    questionText: 'What are the white reflective studs on a motorway used to indicate?',
    options: [
      'The centre of the carriageway',
      'Lane markings between lanes on the main carriageway',
      'The edge of the road at the nearside',
      'The boundary between the hard shoulder and the main carriageway',
    ],
    correctIndex: 1,
    explanation:
      'White studs mark lane boundaries between lanes on the main carriageway. Red studs mark the left edge of the carriageway next to the hard shoulder. Amber studs mark the central reservation. Green studs appear at lay-bys and slip roads.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_009',
    questionText: 'Motorway fog patches can appear suddenly. What should you do when you see a sign warning of fog?',
    options: [
      'Maintain speed but turn on fog lights immediately',
      'Reduce speed and increase your following distance before entering the fog',
      'Switch to the right-hand lane where visibility is better',
      'Sound your horn periodically to warn other drivers',
    ],
    correctIndex: 1,
    explanation:
      'Reduce speed before reaching the fog and leave more distance to the vehicle ahead. Once in fog, use dipped headlights or fog lights if visibility falls below 100 metres. Do not suddenly brake when entering fog as this can cause rear-end collisions.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_010',
    questionText: 'You see emergency flashing amber lights on a motorway maintenance vehicle. What does this mean?',
    options: [
      'The vehicle is broken down - slow down and move to a different lane',
      'There is a lane closure or road works - slow down, take care, and follow any instructions',
      'The vehicle is about to leave the motorway - maintain your speed',
      'The vehicle is warning of a hazard in the central reservation only',
    ],
    correctIndex: 1,
    explanation:
      'Amber flashing lights on maintenance vehicles indicate road works or a hazard. Reduce speed, increase your following distance, and obey any temporary speed limit signs. Workers may be nearby.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_011',
    questionText: 'On a smart motorway, what does it mean when no speed limit is displayed on an overhead gantry?',
    options: [
      'The national speed limit applies',
      'You must slow to 40mph as the default smart motorway limit',
      'The lane is closed',
      'You must use the hard shoulder as a running lane',
    ],
    correctIndex: 0,
    explanation:
      'On a smart motorway, when no speed limit is displayed on the overhead sign, the national speed limit applies (70mph for cars). Speed limits are only enforced when they are displayed on the gantry.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_012',
    questionText: 'Can learner drivers use motorways?',
    options: [
      'No - motorways are prohibited for learner drivers at all times',
      'Yes, but only when accompanied by an approved driving instructor in a dual-controlled car',
      'Yes, but only on quiet motorways between 10pm and 6am',
      'Yes, provided a qualified driver is present and the learner drives below 50mph',
    ],
    correctIndex: 1,
    explanation:
      'Since June 2018, learner drivers are permitted on motorways in England, Scotland, and Wales, but only when accompanied by an approved driving instructor (ADI) in a car fitted with dual controls.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_013',
    questionText: 'When driving on a smart motorway where the hard shoulder is used as a running lane, what should you do if your vehicle has a problem?',
    options: [
      'Continue to the next junction as there is no hard shoulder',
      'Stop in the live lane and switch on hazard lights',
      'Reach the nearest Emergency Refuge Area (ERA) and call for help',
      'Drive on the central reservation verge until help arrives',
    ],
    correctIndex: 2,
    explanation:
      'On a smart motorway with no permanent hard shoulder, drive to the nearest Emergency Refuge Area (ERA). These are marked by orange SOS phones and blue signs. If you cannot reach an ERA, pull as far left as possible, switch on hazard lights, and call 999.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 3,
  },
  {
    id: 'MOT_014',
    questionText: 'You are driving on a motorway and feel very tired. What is the safest course of action?',
    options: [
      'Open the windows and turn up the radio to stay alert',
      'Pull over at the next service area, drink coffee, and take a short sleep',
      'Slow to 50mph and keep to the left lane until you feel better',
      'Ask a passenger to talk to you to maintain alertness',
    ],
    correctIndex: 1,
    explanation:
      'If you feel tired on a motorway, leave at the next junction or services. Take a proper rest break - ideally a 15-20 minute nap. Caffeine can provide short-term help while you find a safe place to stop, but it is not a substitute for rest.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_015',
    questionText: 'What should you do if you accidentally miss your motorway exit?',
    options: [
      'Stop on the hard shoulder and reverse back to the exit',
      'Continue to the next exit and leave there',
      'Cross the central reservation to return in the other direction',
      'Perform a U-turn as soon as there is a gap in traffic',
    ],
    correctIndex: 1,
    explanation:
      'If you miss your exit, continue to the next junction and leave there. Never reverse on a motorway - it is extremely dangerous and illegal. Crossing the central reservation or performing a U-turn are equally prohibited.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_016',
    questionText: 'What colour are the reflective studs on the boundary between the hard shoulder and the main motorway carriageway?',
    options: [
      'White',
      'Green',
      'Red',
      'Amber',
    ],
    correctIndex: 2,
    explanation:
      'Red reflective studs mark the left edge of the carriageway, separating the main lanes from the hard shoulder. White studs mark lane boundaries between main lanes. Amber studs mark the central reservation. Green studs appear at lay-bys, service areas, and slip roads.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_017',
    questionText: 'What do amber reflective studs on a motorway mark?',
    options: [
      'The boundary between the hard shoulder and the nearside lane',
      'The boundary between lanes in the main carriageway',
      'The edge of the central reservation',
      'Motorway service areas and exits',
    ],
    correctIndex: 2,
    explanation:
      'Amber studs are placed at the boundary of the central reservation on each side of the motorway. Along with the white, red, and green studs, they form the motorway stud colour-coding system that helps drivers stay oriented, particularly in poor visibility.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 3,
  },
  {
    id: 'MOT_018',
    questionText: 'What do the three countdown markers before a motorway exit represent?',
    options: [
      '3 miles, 2 miles, and 1 mile to the exit',
      '300 yards, 200 yards, and 100 yards to the start of the slip road',
      '3 minutes, 2 minutes, and 1 minute of driving at 70mph to the exit',
      '3 junctions, 2 junctions, and 1 junction to your destination',
    ],
    correctIndex: 1,
    explanation:
      'The three countdown markers (with three, two, then one diagonal stripe) placed before a motorway exit represent 300, 200, and 100 yards to the start of the slip road. They help drivers plan their exit in good time without last-minute lane changes.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_019',
    questionText: 'You are approaching a contraflow on a motorway. What should you do?',
    options: [
      'Move to the right-hand lanes as they will not be affected',
      'Reduce speed, follow temporary lane markings, and maintain a safe distance from the vehicle ahead',
      'Increase speed to clear the contraflow section quickly',
      'Flash your lights to warn oncoming traffic in the adjacent lanes',
    ],
    correctIndex: 1,
    explanation:
      'In a motorway contraflow, lanes are narrowed and run against the normal direction of traffic in parts of the road. Slow down, follow temporary lane markings and signs, and give extra space to the vehicle ahead as stopping distances in contraflows are reduced by the narrower lanes.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_020',
    questionText: 'What is middle-lane hogging on a motorway, and what are the potential consequences?',
    options: [
      'Travelling in the middle lane while other traffic passes on the right - a minor courtesy issue with no legal consequence',
      'Remaining in the middle lane unnecessarily when the left lane is clear - a careless driving offence that can result in a fixed penalty',
      'Travelling at or below 40mph in the middle lane, causing a hazard',
      'Following too closely behind middle-lane traffic',
    ],
    correctIndex: 1,
    explanation:
      'Middle-lane hogging means occupying the middle lane when the left lane is clear, forcing overtaking traffic into the right lane. This is unnecessary use of the middle lane, reduces road capacity, and is a careless driving offence. Police can issue a Fixed Penalty Notice of £100 and 3 penalty points.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_021',
    questionText: 'What speed limit applies in an active motorway roadworks zone with a mandatory limit displayed?',
    options: [
      'Advisory only - you can exceed it if the road is clear',
      'Mandatory - fixed cameras are often in place and it is a legal requirement',
      '20mph below the limit displayed, as it allows for roadworks hazards',
      'The national speed limit - roadwork signs are advisory only during off-peak hours',
    ],
    correctIndex: 1,
    explanation:
      'Speed limits displayed in motorway roadworks (typically 50mph or 60mph on overhead gantries) are legally enforceable. Average speed cameras are frequently used to enforce these limits over the entire roadworks section. Ignoring them is an offence.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_022',
    questionText: 'You are driving on an unlit motorway at night. What lights should you use?',
    options: [
      'Sidelights only, as the white road markings provide sufficient visibility',
      'Dipped headlights, switching to full beam when no other vehicles are nearby',
      'Full beam at all times, as motorways are wider than other roads',
      'Hazard lights to make yourself visible to other drivers',
    ],
    correctIndex: 1,
    explanation:
      'On an unlit motorway at night, use dipped headlights as a minimum. When the road ahead is clear of other traffic (no vehicles in front and no oncoming lights visible), switch to full beam for greater visibility. Switch back to dipped beams when another vehicle comes within range.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_023',
    questionText: 'A large animal is spotted on the motorway carriageway. What should you do?',
    options: [
      'Flash your lights and sound your horn to chase it off the road',
      'Slow down, keep well back, switch on hazard lights, and call the police',
      'Stop on the hard shoulder and attempt to guide the animal to safety',
      'Drive slowly past it, keeping to the right-hand lane',
    ],
    correctIndex: 1,
    explanation:
      'Do not attempt to approach or herd the animal yourself. Slow down progressively, switch on hazard lights to warn other drivers, keep a safe distance, and call the police (999 if it creates an immediate danger, 101 otherwise). Never leave your vehicle on the carriageway.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_024',
    questionText: 'Is it legal to stop on the hard shoulder of a motorway to have a rest break?',
    options: [
      'Yes, provided you switch on your hazard lights',
      'Yes, but only for stops of less than 15 minutes',
      'No - the hard shoulder is only for genuine breakdowns and emergencies',
      'Yes, if you are in the left-hand section well away from the carriageway',
    ],
    correctIndex: 2,
    explanation:
      'Stopping on the hard shoulder for a rest, comfort break, or to use a phone is illegal. The hard shoulder (where it exists) is reserved for genuine breakdowns, emergencies, and direction from police or a motorway sign. Use a motorway services area for planned breaks.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_025',
    questionText: 'What is the recommended minimum following distance on a dry motorway at 70mph, according to the Highway Code?',
    options: [
      '1 second',
      '2 seconds',
      '3 seconds',
      '4 seconds',
    ],
    correctIndex: 1,
    explanation:
      'The Highway Code recommends a minimum 2-second gap in dry conditions. This equates to approximately 96 metres at 70mph. In wet conditions, double this to 4 seconds, or more. In fog or snow, leave an even greater gap.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_026',
    questionText: 'On a smart motorway with no permanent hard shoulder, where should you aim to stop if your vehicle develops a serious problem?',
    options: [
      'Stop in the left lane and switch on hazard lights',
      'Stop on the painted hatched areas at the sides of the motorway',
      'Reach an Emergency Refuge Area (ERA) as quickly as you safely can',
      'Continue at reduced speed to the next services',
    ],
    correctIndex: 2,
    explanation:
      'Emergency Refuge Areas (ERAs) are lay-by areas at regular intervals on smart motorways where the hard shoulder is used as a running lane. They have orange SOS phones and are clearly signed in blue. If you cannot reach an ERA, pull as far left as possible, switch on hazard lights, and call 999.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_027',
    questionText: 'You are travelling in the left lane on a motorway and approaching a car that has stopped on the hard shoulder. What should you do?',
    options: [
      'Move to the middle lane and increase speed to clear the scene quickly',
      'Slow down and, if safe, move one lane to the right to give space to the stopped vehicle',
      'Sound your horn to warn the occupants that traffic is approaching',
      'Stay in the left lane and maintain normal speed',
    ],
    correctIndex: 1,
    explanation:
      'When passing a vehicle stopped on the hard shoulder or an emergency refuge area, slow down and move one lane to the right if it is safe to do so. People may be working near the vehicle or at the roadside. This is the "Move Over" principle, which became law in some circumstances in the UK.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_028',
    questionText: 'What does a flashing amber light on an overhead motorway gantry indicate?',
    options: [
      'The motorway is operating normally - no action needed',
      'A hazard ahead - slow down and be prepared to stop',
      'A lane is closed to the left of the sign',
      'The variable speed limit has been removed and the national limit applies',
    ],
    correctIndex: 1,
    explanation:
      'A flashing amber light on a motorway overhead gantry warns of a hazard or unusual conditions ahead. You should slow down, be cautious, and be prepared to stop if necessary. This may precede a red X lane closure or a variable speed limit being introduced ahead.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_029',
    questionText: 'Is it legal to overtake on the left (undercut) on a motorway?',
    options: [
      'Yes, always - motorway overtaking rules are more flexible',
      'Yes, but only if the vehicle ahead is lane hogging',
      'No - overtaking on the left is not permitted on a motorway except when traffic is in queues moving at different speeds',
      'Only motorcycles may overtake on the left on a motorway',
    ],
    correctIndex: 2,
    explanation:
      'Undertaking (passing on the left) is generally not permitted on a motorway. The exception is when traffic is in queues and the left lane is moving faster - such as in congestion. Even then, it must be done safely. Deliberate high-speed undertaking outside of queuing traffic is illegal and dangerous.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_030',
    questionText: 'What should you do if your vehicle starts to overheat on a motorway?',
    options: [
      'Continue driving but switch on the heater to help cool the engine',
      'Pull onto the hard shoulder safely, switch off the engine, and call for recovery',
      'Slow to 30mph and continue to the next services',
      'Open the bonnet immediately to release the heat, even on the carriageway',
    ],
    correctIndex: 1,
    explanation:
      'If warning lights or steam indicate overheating, pull over onto the hard shoulder if safe. Switch off the engine - running a severely overheated engine causes permanent damage. Call for recovery. Never open a hot radiator cap; the coolant is under pressure. Do not attempt to continue to the next junction if the engine is seriously overheating.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_031',
    questionText: 'What do the chevron markings painted on the road in motorway roadworks indicate?',
    options: [
      'They show the direction of the contraflow lane',
      'They indicate that you must not drive over them',
      'They are spacing guides - keep at least two chevrons apart from the vehicle in front',
      'They show the position of average speed cameras',
    ],
    correctIndex: 2,
    explanation:
      'In motorway roadworks, chevron markings are painted on the road to help drivers maintain a safe following distance. Highway Code guidance is to keep at least two chevrons between your vehicle and the vehicle ahead. Each chevron represents approximately one car length.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_032',
    questionText: 'When leaving a motorway via a slip road, when should you reduce your speed?',
    options: [
      'As you enter the slip road, not before',
      'Before reaching the slip road to help traffic flow on the motorway',
      'Only once the speed limit sign is visible on the slip road',
      'You should maintain motorway speed until the end of the slip road',
    ],
    correctIndex: 0,
    explanation:
      'Slow down once you have moved onto the slip road, not while still on the motorway itself. High-speed braking on the motorway to prepare for an exit can cause rear-end collisions. Use the slip road\'s length to progressively reduce speed to match the new road.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_033',
    questionText: 'You are travelling at 70mph and the vehicle in front suddenly brakes hard. How far will your vehicle travel during your reaction time alone (before you touch the brake)?',
    options: [
      'About 14 metres',
      'About 21 metres',
      'About 38 metres',
      'About 53 metres',
    ],
    correctIndex: 2,
    explanation:
      'At 70mph with an average reaction time of about 0.67 seconds, a vehicle travels roughly 21 metres. However, the Highway Code thinking distance (which includes perception and reaction) at 70mph is approximately 21 metres - but under poor conditions such as tiredness or distraction this can be much longer. Stopping distance at 70mph is 96 metres total.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 3,
  },
  {
    id: 'MOT_034',
    questionText: 'Can you use a mobile phone while stationary in a traffic queue on a motorway?',
    options: [
      'Yes, because you are not in motion',
      'Yes, but only briefly to check a navigation app',
      'No - using a hand-held mobile phone in a vehicle is illegal when the engine is running, including in queuing traffic',
      'Yes, as long as you have both hands on the wheel when traffic begins to move',
    ],
    correctIndex: 2,
    explanation:
      'It is illegal to use a hand-held mobile phone while driving, which includes when stationary in traffic with the engine running. The law does not make an exception for stationary queuing traffic. Penalties include £200 fine and 6 penalty points. Hands-free use is permitted but not encouraged.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_035',
    questionText: 'When joining a motorway from a slip road, what should you do if there is no gap in the traffic to merge into?',
    options: [
      'Stop at the end of the slip road and wait for a gap',
      'Force your way in - motorway traffic should make way for joining vehicles',
      'Slow down on the slip road and match your speed to an approaching gap',
      'Use the hard shoulder to drive alongside the motorway until a gap appears',
    ],
    correctIndex: 2,
    explanation:
      'If there is no gap immediately available, reduce speed on the slip road to match a gap that is forming in the left lane. You must not stop at the end of a slip road (a significant hazard) and must not use the hard shoulder as an additional joining lane. Traffic on the motorway has priority.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_036',
    questionText: 'What should you do with your hazard warning lights after breaking down on the hard shoulder?',
    options: [
      'Switch them on as soon as you realise there is a problem, before pulling over',
      'Switch them on once the vehicle is safely stopped on the hard shoulder',
      'Only use them if it is dark or visibility is reduced',
      'Do not use them as they may confuse other drivers',
    ],
    correctIndex: 1,
    explanation:
      'Once your vehicle is safely stopped on the hard shoulder, switch on your hazard warning lights. This warns approaching traffic that your vehicle is stationary. Do not activate them while still moving on the carriageway as this can confuse following drivers.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_037',
    questionText: 'Which of the following is NOT a reason to use hazard warning lights on a motorway?',
    options: [
      'Your vehicle has broken down on the hard shoulder',
      'You are the back vehicle in a queue that has come to a sudden stop',
      'To warn following traffic of a hazard or sudden queue ahead',
      'To thank a driver who has allowed you to merge',
    ],
    correctIndex: 3,
    explanation:
      'Hazard warning lights must not be used to thank another driver - this is the purpose of a brief wave or nod. On a motorway, hazard lights are appropriate when broken down, when warning following traffic of a sudden hazard or queue, or in an emergency. Using them incorrectly can confuse and mislead other drivers.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_038',
    questionText: 'What is a "ghost island" on a motorway, and where might you find it?',
    options: [
      'A poorly lit section of motorway near a tunnel entrance',
      'A painted area in the centre of a junction or widened road section, used to divide traffic flows',
      'An unmarked area of the hard shoulder that has no road surface markings',
      'A raised central reservation used at temporary contraflow sections',
    ],
    correctIndex: 1,
    explanation:
      'A ghost island is a hatched area (painted diagonal lines) painted on the road surface, often used to separate turning traffic or at motorway junctions and lane merges. It is not physically raised. You should not normally drive on a ghost island bordered by solid white lines, but may drive over a ghost island bordered by broken white lines if it is safe.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 3,
  },
  {
    id: 'MOT_039',
    questionText: 'What is the maximum speed limit in a motorway roadworks zone where an overhead 50mph variable limit is displayed?',
    options: [
      '50mph - this is a mandatory limit',
      '60mph - the variable limit adds a 10mph buffer',
      '40mph - all displayed limits include a 10mph reduction for safety',
      'There is no maximum - the display is advisory',
    ],
    correctIndex: 0,
    explanation:
      '50mph displayed on a motorway overhead gantry in a roadworks zone is a mandatory speed limit, not advisory. There is no buffer. Average speed cameras are typically in use throughout the roadworks zone and prosecute drivers who exceed the displayed limit.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_040',
    questionText: 'A blue motorway sign shows "Services 2 miles". What can you typically expect to find at a motorway services?',
    options: [
      'A roundabout to change direction if you have missed your exit',
      'Fuel, toilets, food and drink, and parking',
      'A police post for reporting accidents',
      'A dedicated breakdown recovery service with repair facilities',
    ],
    correctIndex: 1,
    explanation:
      'Motorway service areas provide fuel, parking, toilets, and food/drink facilities. They are the only safe and legal places to stop for a rest or comfort break on the motorway. You cannot legally return to the motorway in the opposite direction after entering a service area.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_041',
    questionText: 'Following a collision on a motorway, other than contacting emergency services, what is the first thing you should do?',
    options: [
      'Set up warning triangles at 150 metres behind the incident',
      'Get everyone away from the vehicles and behind the crash barrier if there is one',
      'Begin first aid on injured parties immediately',
      'Take photos of the scene for insurance purposes',
    ],
    correctIndex: 1,
    explanation:
      'After a motorway collision, the immediate priority is to get all uninjured people away from the vehicles and behind the safety barrier if possible. Motorways are extremely dangerous environments for pedestrians. Call 999 immediately and keep yourself and others safe first. Do not walk on the motorway carriageway.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 3,
  },
  {
    id: 'MOT_042',
    questionText: 'At what age can a person drive on a motorway in the UK?',
    options: [
      '17, the same age as the minimum for a full car licence',
      '17 in a car with an ADI instructor, 18 independently once the full licence is held',
      '18, as a full licence is required for motorway driving',
      '17, but only as a passenger alongside a qualified driver',
    ],
    correctIndex: 1,
    explanation:
      'Learner drivers (minimum age 17) may drive on a motorway accompanied by an ADI in a dual-controlled car. Once a full licence is obtained (minimum age effectively 17 after passing the driving test), the driver may use the motorway unaccompanied. There is no separate age restriction beyond holding a full licence.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_043',
    questionText: 'Why is it particularly important to check your mirrors more frequently on a motorway?',
    options: [
      'Because mirrors deteriorate faster at motorway speeds',
      'Because vehicles approach from behind at high speed and situations can change rapidly',
      'Because you must signal before changing lanes, requiring a mirror check every 5 seconds',
      'The Highway Code requires a mirror check every 30 seconds at all times',
    ],
    correctIndex: 1,
    explanation:
      'At motorway speeds, a vehicle can close from 400 metres away in under 10 seconds. Regular mirror checks allow you to be aware of faster-approaching vehicles before you change lanes or slow down. The Highway Code recommends using the mirrors frequently so you are always aware of what is behind and alongside you.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_044',
    questionText: 'You are on a motorway and a thick bank of fog forms unexpectedly ahead. What should you do?',
    options: [
      'Maintain your speed - braking suddenly in fog causes rear-end collisions',
      'Reduce speed progressively using braking signals visible to following traffic, increase following distance, and use fog lights if visibility is below 100 metres',
      'Move to the right-hand lane where visibility is better',
      'Pull onto the hard shoulder and wait for the fog to clear',
    ],
    correctIndex: 1,
    explanation:
      'Fog in motorway conditions is extremely dangerous. Slow down progressively (use braking visible to others), increase following distance, and use dipped headlights with rear fog lights if visibility is below 100 metres. Never stop on the motorway carriageway in fog - move to the hard shoulder only if unavoidable and your vehicle has broken down.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_045',
    questionText: 'What does a green sign on a motorway with white text and white border indicate?',
    options: [
      'A diversion route from the main motorway',
      'A primary route sign for major destinations on the motorway network',
      'A tourist attraction or area of interest',
      'A motorway service area within 1 mile',
    ],
    correctIndex: 1,
    explanation:
      'Green signs with white text are used for motorway direction signs, indicating major destinations, junction numbers, and route information. Blue signs indicate general motorway information. Brown signs indicate tourist destinations. Yellow signs indicate temporary diversions.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_046',
    questionText: 'How should you signal before changing lanes to overtake on a motorway?',
    options: [
      'Switch on your indicator as you start to move across into the new lane',
      'Check your mirrors, signal right in good time before the lane change, check blind spot, then move',
      'A signal is only needed when moving right - returning to the left is expected and no signal is needed',
      'Flash your headlights at the vehicle ahead before signalling to move around it',
    ],
    correctIndex: 1,
    explanation:
      'Use the Mirror-Signal-Manoeuvre (MSM) routine. Check mirrors first, then signal right in good time to allow following traffic to react, check your blind spot, and then make the lane change. You should also signal when returning to the left lane. The signal must be given before the manoeuvre begins, not during.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 1,
  },
  {
    id: 'MOT_047',
    questionText: 'A breakdown warning triangle - should you use one if you break down on a motorway?',
    options: [
      'Yes, place it 150 metres behind your vehicle on the carriageway',
      'No - never place a warning triangle on a motorway, as walking on the carriageway is extremely dangerous',
      'Only if you have one that has a flashing light built in',
      'Yes, but only on the hard shoulder edge, not the carriageway',
    ],
    correctIndex: 1,
    explanation:
      'Warning triangles are recommended for use on ordinary roads but must NOT be used on motorways. Placing one requires walking on the carriageway, which is extremely dangerous. Instead, use your hazard warning lights, exit through the nearside door, move behind the barrier, and call for help from a safe position.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_048',
    questionText: 'What is the typical spacing between Emergency Refuge Areas (ERAs) on a smart motorway in the UK?',
    options: [
      'Every 500 metres',
      'Every 1 mile',
      'Every 1.5 to 2.5 miles',
      'Every 5 miles',
    ],
    correctIndex: 2,
    explanation:
      'Emergency Refuge Areas on smart motorways are typically positioned every 1.5 to 2.5 miles (approximately every 2.4 to 4 km). Government guidance has focused on reducing this spacing on new and upgraded smart motorways to improve safety following concern about vehicles stranded in live lanes.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 3,
  },
  {
    id: 'MOT_049',
    questionText: 'After driving at motorway speeds for a long time and then taking an exit, why might your speed perception be affected?',
    options: [
      'Motorway driving reduces reaction time, making normal speeds feel faster',
      'Your brain adapts to high speed, making lower speeds feel slower than they actually are, causing you to drive too fast on slower roads',
      'Your speedometer becomes less accurate at sustained high speeds',
      'Your tyres produce less feedback at reduced speeds after motorway driving',
    ],
    correctIndex: 1,
    explanation:
      'After sustained motorway driving, your brain adjusts to high speed as the new "normal". When you exit onto a lower-speed road, 40mph or 30mph can feel dangerously slow, causing drivers to unconsciously speed. Always check your speedometer when leaving a motorway rather than relying on feel.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
  {
    id: 'MOT_050',
    questionText: 'Under what circumstances may you cross the solid white line on the right-hand side of the hard shoulder of a motorway to rejoin the carriageway?',
    options: [
      'At any time, when you judge it is safe',
      'Only when directed by a police officer or a motorway sign to do so',
      'When your vehicle is repaired and you are ready to continue your journey',
      'Whenever there is a suitable gap in the left-hand lane',
    ],
    correctIndex: 1,
    explanation:
      'You may only rejoin the motorway from the hard shoulder when it is safe to do so and you have built up sufficient speed to merge smoothly with motorway traffic - or when directed by police or signs. Always check mirrors and signal before rejoining. Never attempt to rejoin at a slow speed into fast-moving motorway traffic.',
    topicCategory: TopicCategory.MotorwayRules,
    difficulty: 2,
  },
];
