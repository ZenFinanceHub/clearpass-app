// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const accidentsAndEmergenciesQuestions: Question[] = [
  {
    id: 'ACE_001',
    questionText: 'You are first on the scene at a serious collision. What is the first priority?',
    options: [
      'Move injured people from their vehicles to the pavement',
      'Warn other traffic and call the emergency services',
      'Attempt CPR on any unconscious casualties',
      'Take photographs for insurance purposes',
    ],
    correctIndex: 1,
    explanation:
      'The first priority is safety - warn other road users of the hazard and call 999 immediately. Moving casualties unnecessarily can cause or worsen spinal injuries. Only move someone if they are in immediate danger (e.g. fire).',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_002',
    questionText: 'A motorcyclist is unconscious after a collision. Should you remove their helmet?',
    options: [
      'Yes, always - it may be obstructing their airway',
      'No, unless there is a specific immediate threat such as fire or vomiting that blocks the airway',
      'Yes, but only if they are breathing normally',
      'No, only trained paramedics should handle helmets',
    ],
    correctIndex: 1,
    explanation:
      'Do not remove a motorcyclist\'s helmet unless there is an immediate life-threatening reason such as vomiting causing airway obstruction, or fire. Removing a helmet incorrectly can worsen a spinal injury.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_003',
    questionText: 'What does the DR ABC acronym stand for in first aid?',
    options: [
      'Danger, Response, Airway, Breathing, Circulation',
      'Direction, Recovery, Assessment, Blood, Control',
      'Danger, Resuscitate, Assess, Bandage, Call',
      'Diagnose, Respond, Airway, Body, Circulation',
    ],
    correctIndex: 0,
    explanation:
      'DR ABC: Danger (check for hazards), Response (check if the casualty is conscious), Airway (open and clear the airway), Breathing (check for normal breathing), Circulation (control severe bleeding, call 999).',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_004',
    questionText: 'A casualty is unconscious and breathing. What position should you place them in?',
    options: [
      'Flat on their back with legs raised',
      'The recovery position (on their side)',
      'Sitting upright to protect the airway',
      'Leave them in whatever position they are found to avoid spinal injury',
    ],
    correctIndex: 1,
    explanation:
      'An unconscious casualty who is breathing should be placed in the recovery position (on their side). This keeps the airway open and allows fluids to drain, preventing choking. Monitor their breathing continuously until help arrives.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_005',
    questionText: 'You witness a collision on a motorway. There are no injuries. What must you legally do?',
    options: [
      'Stop and give your details to all parties involved',
      'You have no legal obligation to stop if you were not involved',
      'Call the police and wait to give a statement',
      'Take photos and report the incident online within 24 hours',
    ],
    correctIndex: 1,
    explanation:
      'If you were not involved in the collision, you have no legal obligation to stop. However, you should call 999 if there are injuries or significant hazards. Good samaritans who stop should take care to park safely away from the scene.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_006',
    questionText: 'What is the correct rate of chest compressions during CPR for an adult?',
    options: [
      '60 per minute',
      '80 per minute',
      '100 to 120 per minute',
      '150 per minute',
    ],
    correctIndex: 2,
    explanation:
      'Adult CPR requires chest compressions at a rate of 100 to 120 per minute, compressed to a depth of 5 to 6 cm. Give 30 compressions followed by 2 rescue breaths if you are trained, or continue compressions only if not.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_007',
    questionText: 'A vehicle catches fire after a collision. What should you do?',
    options: [
      'Try to extinguish the fire using whatever is available',
      'Move all casualties at least 100 metres away from the vehicle and call 999 immediately',
      'Wait near the vehicle in case the fire self-extinguishes',
      'Remove the vehicle\'s battery to prevent an electrical fire spreading',
    ],
    correctIndex: 1,
    explanation:
      'A vehicle fire can escalate rapidly and the fuel tank may explode. Move all casualties as far from the vehicle as possible and call 999. Do not attempt to fight a vehicle fire without specialist equipment.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_008',
    questionText: 'At a collision scene, a casualty has a severe arterial bleed. What should you do first?',
    options: [
      'Apply a tourniquet above the wound immediately',
      'Apply firm, direct pressure to the wound with a clean cloth or bandage',
      'Elevate the wound and wait for the bleeding to slow naturally',
      'Clean the wound thoroughly before applying any pressure',
    ],
    correctIndex: 1,
    explanation:
      'Apply firm, continuous direct pressure to a severe wound. Use the cleanest material available. Do not remove the material if it becomes soaked - add more on top. Maintain pressure until medical help arrives. Tourniquets are a last resort when a limb bleed is life-threatening.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_009',
    questionText: 'You are involved in a collision in which another person is injured. Which of the following must you do by law?',
    options: [
      'Call your insurance company within 24 hours',
      'Stop, exchange details with anyone involved, and report to the police within 24 hours if details were not exchanged',
      'Stop and wait for the police, however long that takes',
      'Leave a written note on the other vehicle if the driver is not present',
    ],
    correctIndex: 1,
    explanation:
      'By law you must stop, give your name and address (and the vehicle owner\'s if different) to anyone with reasonable grounds to require them. If a person is injured and you cannot exchange details, you must report the collision to the police within 24 hours.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_010',
    questionText: 'You arrive at a collision where fuel is leaking. What is the greatest danger and how should you manage it?',
    options: [
      'Explosion - warn others to stay back and keep all ignition sources away',
      'Slipping - spread absorbent material over the fuel spill',
      'Environmental damage - call the Environment Agency immediately',
      'Fire is unlikely from spilled fuel - attend to casualties first',
    ],
    correctIndex: 0,
    explanation:
      'Fuel vapour is highly flammable and can ignite from a single spark. Keep all ignition sources (lighters, phones, running engines) away from the spill, warn others not to smoke, and call 999 immediately. Do not attempt to move the vehicle.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_011',
    questionText: 'What information should you give when calling 999 at a crash scene?',
    options: [
      'Your name and insurance details only',
      'Your exact location, what happened, how many casualties there are, and the nature of any injuries',
      'The registration numbers of all vehicles involved',
      'A description of any witnesses who saw the collision',
    ],
    correctIndex: 1,
    explanation:
      'Tell the operator: your location (road name, nearest landmark or junction), what has happened, how many people are injured, the severity of those injuries, and any hazards such as fuel leaks or obstructions. Stay on the line if asked.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_012',
    questionText: 'A child has swallowed something and is choking. They cannot cough or speak. What should you do?',
    options: [
      'Lay them flat and perform chest compressions',
      'Give up to 5 back blows between the shoulder blades, then up to 5 abdominal thrusts, and call 999',
      'Encourage them to drink water to dislodge the object',
      'Wait to see if they can clear it naturally before taking action',
    ],
    correctIndex: 1,
    explanation:
      'For a choking child: give up to 5 back blows with the heel of your hand between the shoulder blades. If unsuccessful, give up to 5 abdominal thrusts. Call 999 immediately. Alternate back blows and thrusts until the object is cleared or help arrives.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_013',
    questionText: 'There is a chemical spillage on the road following a collision with a tanker. What should you do?',
    options: [
      'Assist the driver in containing the spill if it is safe to do so',
      'Keep well clear, warn others to stay back, and call 999 giving details of any hazard symbols or labels on the vehicle',
      'Cover the spillage with sand or soil to prevent it spreading',
      'Allow traffic through slowly as chemicals rarely cause fires',
    ],
    correctIndex: 1,
    explanation:
      'Keep everyone well away from a chemical spillage - it may be toxic, flammable, or corrosive. Call 999 and report any hazard symbols (orange panels with UN numbers) on the tanker. The fire service has specialist equipment to handle chemical incidents.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_014',
    questionText: 'A driver suffers a suspected heart attack at the wheel. What is the immediate priority?',
    options: [
      'Call their GP before calling 999',
      'Stop the vehicle safely, call 999, and be prepared to start CPR if needed',
      'Drive them to the nearest hospital rather than waiting for an ambulance',
      'Give them aspirin and wait to see if the symptoms subside',
    ],
    correctIndex: 1,
    explanation:
      'Bring the vehicle to a safe stop as quickly as possible. Call 999 immediately and describe the symptoms. Stay with the person - if they lose consciousness and stop breathing, begin CPR. Time is critical in a cardiac event.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_015',
    questionText: 'You discover a vehicle with a baby or young child locked inside on a hot day. The child appears distressed. What should you do?',
    options: [
      'Wait for the driver to return - they are probably nearby',
      'Call 999, tell them what you see, and if the child is in immediate danger break the window away from the child',
      'Open the car yourself by triggering the window mechanism',
      'Call the local council as this is not a police matter',
    ],
    correctIndex: 1,
    explanation:
      'Call 999 immediately. The police can authorise breaking the window. If the child is in immediate danger and the police cannot attend quickly, break the window as far from the child as possible. Inform the police of your actions to avoid prosecution.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
];
