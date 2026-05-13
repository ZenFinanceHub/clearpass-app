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
  {
    id: 'ACE_016',
    questionText: 'A casualty at a collision scene is showing signs of shock. Which of the following is NOT a sign of shock?',
    options: [
      'Pale, cold, and clammy skin',
      'Rapid, shallow breathing',
      'A strong, slow pulse',
      'Confusion or dizziness',
    ],
    correctIndex: 2,
    explanation:
      'Signs of shock include pale, cold, clammy skin; rapid shallow breathing; a fast, weak pulse; confusion; and nausea. A strong, slow pulse is not typical of shock. Lay the casualty down, raise their legs if there is no leg injury, keep them warm, and call 999.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_017',
    questionText: 'You suspect a collision casualty has a spinal injury. What is the key principle in managing this?',
    options: [
      'Sit them up carefully to keep pressure off the spine',
      'Move them only if they are in immediate danger, keeping the head, neck, and spine aligned',
      'Remove their helmet and neck jewellery to prevent restriction',
      'Ask them to stand if they are conscious, as walking will reveal the extent of the injury',
    ],
    correctIndex: 1,
    explanation:
      'A suspected spinal injury means the casualty must not be moved unless there is immediate life-threatening danger (e.g. fire). If movement is essential, keep the head, neck, and spine in alignment. Unnecessary movement can cause permanent paralysis.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_018',
    questionText: 'What should you do if someone at a collision scene has a suspected broken bone?',
    options: [
      'Straighten the limb carefully to reduce swelling',
      'Support the injured part in the position found, do not attempt to move or straighten it, and call for medical help',
      'Tie the limb tightly to the nearest solid object to prevent movement',
      'Ask the casualty to move the limb gently to confirm whether it is broken',
    ],
    correctIndex: 1,
    explanation:
      'Do not attempt to straighten or move a suspected fracture. Support the injured limb in the position you find it using padding or improvised splints. Keep the casualty still and comfortable and call for medical assistance. Incorrect manipulation can worsen the injury.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_019',
    questionText: 'Someone is having an epileptic seizure at a collision scene. What should you do?',
    options: [
      'Restrain them firmly to prevent injury during the seizure',
      'Put something in their mouth to stop them biting their tongue',
      'Clear the area around them, protect their head, and do not restrain them',
      'Give them water as soon as the shaking begins',
    ],
    correctIndex: 2,
    explanation:
      'During a seizure, never restrain the person or put anything in their mouth. Clear the immediate area of hazards, cushion their head, and time the seizure. After it stops, place them in the recovery position. Call 999 if the seizure lasts more than 5 minutes, it is their first seizure, or they do not regain consciousness.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_020',
    questionText: 'A casualty at a crash scene has a burn from contact with hot engine parts. What is the correct immediate treatment?',
    options: [
      'Apply butter or toothpaste to soothe the burn',
      'Cool the burn with cool (not cold) running water for at least 10 minutes',
      'Cover immediately with a dry dressing without cooling',
      'Burst any blisters to release pressure and apply antiseptic cream',
    ],
    correctIndex: 1,
    explanation:
      'Cool burns immediately with cool or tepid running water for at least 10 minutes. Do not use ice, butter, or any cream. Do not burst blisters. After cooling, cover loosely with cling film or a clean non-fluffy material. Severe burns need hospital treatment urgently.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_021',
    questionText: 'A driver at the roadside appears confused, is sweating heavily, and is shaking. They tell you they are diabetic. What is the most likely cause?',
    options: [
      'A diabetic hyperglycaemic episode (high blood sugar)',
      'A diabetic hypoglycaemic episode (low blood sugar)',
      'A side effect of their medication unrelated to blood sugar',
      'Dehydration from driving in warm weather',
    ],
    correctIndex: 1,
    explanation:
      'Sweating, shaking, confusion, and pallor in a diabetic person typically indicate hypoglycaemia (low blood sugar). If they are conscious, give them a sugary drink, glucose tablets, or sweet food. If unconscious, do not give anything by mouth - call 999. Do not leave them alone.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_022',
    questionText: 'Where should you place a warning triangle at the scene of a breakdown on a normal road (not a motorway)?',
    options: [
      'On top of the vehicle where it can be seen by oncoming traffic',
      'Approximately 45 metres behind the vehicle on the same side of the road',
      'At the nearest junction to warn traffic before it turns into the affected road',
      'Immediately behind the vehicle to show traffic exactly where to stop',
    ],
    correctIndex: 1,
    explanation:
      'A warning triangle should be placed approximately 45 metres (50 yards) behind the broken-down vehicle on the same side of the road. This gives approaching drivers enough warning to slow down. On a motorway, do not use a warning triangle - walking on the carriageway is too dangerous.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_023',
    questionText: 'What are the FAST signs used to identify a potential stroke?',
    options: [
      'Fever, Arm weakness, Shallow breathing, Time to call 999',
      'Face drooping, Arm weakness, Speech difficulty, Time to call 999',
      'Fatigue, Altered vision, Slow responses, Time to rest',
      'Flushing, Anxiety, Seizure, Treatment required',
    ],
    correctIndex: 1,
    explanation:
      'FAST stands for: Face drooping (one side drooping or numb), Arm weakness (unable to raise both arms), Speech difficulty (slurred or strange speech), Time to call 999. Stroke is a medical emergency - call 999 immediately. Do not give anything to eat or drink.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_024',
    questionText: 'At a night-time collision, what should you do immediately to protect the scene and prevent further crashes?',
    options: [
      'Stand in the road 200 metres back and wave your arms to stop traffic',
      'Switch on hazard lights on all vehicles involved, use a torch, and call 999',
      'Drive your vehicle in a blocking position across the road to stop traffic',
      'Set up flares on both sides of the collision to light the scene',
    ],
    correctIndex: 1,
    explanation:
      'At a night collision, activate hazard warning lights on all vehicles if safe to do so, use a torch to stay visible and help others see the scene, and call 999. Do not stand in the road yourself to stop traffic. Stay on the verge or pavement where possible.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_025',
    questionText: 'A casualty is not breathing normally. When should you begin CPR?',
    options: [
      'Only if a defibrillator (AED) is available at the scene',
      'Immediately, once you have confirmed the casualty is unresponsive and not breathing normally',
      'After 2 minutes of observation to confirm breathing has stopped',
      'Only if you have received formal CPR training',
    ],
    correctIndex: 1,
    explanation:
      'Begin CPR as soon as the casualty is confirmed as unresponsive and not breathing normally (occasional gasps are not normal breathing). You do not need formal training to start - even compression-only CPR gives the person a chance. Call 999 first or ask someone else to call while you start CPR.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_026',
    questionText: 'A collision has occurred just around a bend. How should you warn approaching traffic?',
    options: [
      'Sound your horn repeatedly to alert drivers around the bend',
      'Use a warning triangle placed well before the bend, or ask someone to stand safely at the roadside before the bend to warn drivers',
      'Park your car across the road to force approaching traffic to stop',
      'Flash your headlights at each vehicle as it comes round the bend',
    ],
    correctIndex: 1,
    explanation:
      'Warn approaching traffic by placing a warning triangle well before the bend - far enough back that drivers can see it and brake safely. Alternatively, have someone stand safely at the side of the road before the bend to wave down traffic. Never stand in the road itself.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_027',
    questionText: 'You arrive at a crash and debris is scattered across the road. What is the immediate risk to other vehicles?',
    options: [
      'No risk - other drivers will naturally slow and avoid the debris',
      'Secondary collisions from vehicles swerving or braking suddenly to avoid the debris',
      'Environmental contamination from oil and fuel',
      'Risk only to motorcycles and cyclists, not cars',
    ],
    correctIndex: 1,
    explanation:
      'Debris on the road causes sudden braking and evasive steering by approaching drivers who may not see it in time. This can cause secondary collisions, sometimes worse than the original. Warn traffic early, call 999, and do not attempt to move debris yourself if it is unsafe to do so.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_028',
    questionText: 'What should you do if a casualty is bleeding from a head wound?',
    options: [
      'Apply firm pressure directly over the wound, unless there is an underlying skull fracture suspected',
      'Pour cold water over the wound to reduce swelling and slow bleeding',
      'Never apply pressure to a head wound as it may cause brain damage',
      'Lay the casualty flat immediately and tilt their head back',
    ],
    correctIndex: 0,
    explanation:
      'Apply firm, direct pressure to a head wound to control bleeding, unless you suspect a skull fracture (visible depression, irregular shape, or clear fluid). If a fracture is suspected, apply pressure only around the wound, not directly on it. Keep the casualty still and call 999.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_029',
    questionText: 'A casualty at a crash is conscious but has signs of internal bleeding (rigid abdomen, pale skin, confusion). What should you do?',
    options: [
      'Give them fluids to replace lost blood volume',
      'Lay them down, keep them warm, do not give food or drink, and call 999 immediately',
      'Apply firm abdominal pressure to stop the internal bleed',
      'Ask them to walk around gently to keep their circulation going',
    ],
    correctIndex: 1,
    explanation:
      'Internal bleeding is life-threatening and cannot be treated at the roadside. Lay the casualty down and keep them warm to manage shock. Do not give anything to eat or drink as surgery may be needed. Call 999 urgently and stay with them, monitoring their condition until help arrives.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_030',
    questionText: 'An electric vehicle (EV) has been in a collision and you smell burning. What extra caution is needed?',
    options: [
      'EVs have no fuel tank so fire risk is lower than with petrol vehicles',
      'EV battery fires are extremely difficult to extinguish and can reignite hours later - keep well back and call 999',
      'Use water to extinguish an EV battery fire as quickly as possible',
      'The main risk is electrocution from the drive motor - do not touch the vehicle',
    ],
    correctIndex: 1,
    explanation:
      'Lithium-ion battery fires in electric vehicles are exceptionally difficult to control and can reignite spontaneously hours or even days later. Do not attempt to fight an EV battery fire. Keep everyone well back and call the fire service. Inform them it is an electric vehicle so they can apply specialist procedures.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_031',
    questionText: 'You are the first at a collision scene where a vehicle is lying on its side. What should you consider before attempting to help casualties inside?',
    options: [
      'The vehicle is stable on its side so immediate entry is safe',
      'Check for hazards: fuel leaks, unstable vehicle, oncoming traffic, and electrical systems before approaching',
      'Push the vehicle upright immediately to make access easier',
      'Break the windscreen first to create an access point',
    ],
    correctIndex: 1,
    explanation:
      'Before approaching, assess hazards: leaking fuel, unstable vehicle posture, oncoming traffic, live electrical systems (especially on EVs). If hazards are present, keep casualties and bystanders clear and call 999. Only help if it is safe to do so - a rescuer becoming a casualty helps no one.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_032',
    questionText: 'A casualty is in shock after a collision. They have no leg injuries. What position should they be placed in?',
    options: [
      'Sitting upright to help breathing',
      'Lying flat with their legs raised approximately 30 cm to increase blood flow to vital organs',
      'The recovery position (on their side)',
      'Propped upright with their back against the vehicle',
    ],
    correctIndex: 1,
    explanation:
      'For a conscious casualty in shock with no leg injury, lay them flat and raise their legs by approximately 30cm. This helps blood flow back to the vital organs. Keep them warm with a coat or blanket. Do not give them anything to eat or drink. Monitor and call 999.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_033',
    questionText: 'A pedestrian has been struck by a vehicle. They are conscious and complaining of severe neck pain. What should you do?',
    options: [
      'Gently straighten their neck to align it and reduce pain',
      'Advise them not to move, support their head and neck manually if trained, and call 999',
      'Sit them upright to relieve pressure on the spine',
      'Help them to a nearby seat away from the road',
    ],
    correctIndex: 1,
    explanation:
      'Severe neck pain after a collision suggests a possible spinal injury. Instruct the casualty to stay absolutely still. If you are trained, provide manual in-line stabilisation of the head. Call 999 immediately. Do not attempt to sit them up, move them, or apply an improvised collar unless trained.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_034',
    questionText: 'What does it mean if a casualty\'s pupil sizes are unequal after a head injury?',
    options: [
      'This is a normal variation and is not medically significant',
      'It can indicate a serious head injury or increased pressure on the brain - a medical emergency',
      'It suggests they have suffered a stroke rather than a head injury',
      'It means they are in a deep sleep and will recover when they wake',
    ],
    correctIndex: 1,
    explanation:
      'Unequal pupil sizes (one larger than the other) after a head injury can indicate serious brain injury or increasing intracranial pressure. This is a critical medical emergency. Ensure 999 has been called, keep the casualty still and as calm as possible, and monitor their consciousness level closely.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_035',
    questionText: 'If a car is submerged in water after driving off a road, what is the recommended technique to escape?',
    options: [
      'Open the window or door immediately before the car goes under',
      'Wait for the car to fill with water to equalise pressure, then push the door open',
      'Call 999 and wait for help - do not risk the door until help arrives',
      'Break the windscreen immediately with your hands',
    ],
    correctIndex: 1,
    explanation:
      'In a submerging vehicle, the doors cannot be opened while water pressure is unequal. Open the window as soon as possible and escape before the car fully submerges. If the window will not open, wait for the interior to fill with water (equalising pressure) then push the door open. A centre punch (car escape tool) can break the side window quickly.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_036',
    questionText: 'After a minor collision with no injuries, what should you do regarding the police?',
    options: [
      'Always call the police - every collision must be reported within 24 hours',
      'Only report it to police if the other party refuses to exchange details or there is a dispute',
      'You never need to report a minor collision to the police',
      'Photograph the scene and submit a report online within 7 days',
    ],
    correctIndex: 1,
    explanation:
      'For a minor collision where details have been exchanged and no one is injured, there is no automatic requirement to involve the police. However, you must report it if injury has occurred, if the other driver fails to stop or exchange details, or if an animal listed in the Road Traffic Act has been injured.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_037',
    questionText: 'A casualty appears to be in anaphylactic shock after a collision (severe allergic reaction). What are the warning signs?',
    options: [
      'Slow, steady pulse with low body temperature',
      'Swelling of the face and throat, difficulty breathing, rash, and a rapid weak pulse',
      'High blood pressure and flushed red skin only',
      'Unconsciousness with normal breathing and pulse',
    ],
    correctIndex: 1,
    explanation:
      'Anaphylaxis causes swelling of the face, lips, and throat; difficulty breathing; pale or blotchy skin; a rapid weak pulse; and possible loss of consciousness. Call 999 immediately - this is life-threatening. If the casualty has an adrenaline auto-injector (EpiPen), help them use it. Lay them down with legs raised unless breathing is difficult.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_038',
    questionText: 'You have given CPR at a crash scene and emergency services have arrived. When should you stop CPR?',
    options: [
      'After 10 minutes - this is the standard maximum duration for bystander CPR',
      'When a paramedic or doctor takes over, or the casualty starts breathing normally',
      'When the casualty\'s colour returns to normal',
      'After 30 cycles of compressions regardless of outcome',
    ],
    correctIndex: 1,
    explanation:
      'Continue CPR until a trained medical professional takes over, the casualty starts breathing normally, you are physically unable to continue, or a medical professional tells you to stop. Never stop CPR just because the casualty\'s colour changes - this is not a reliable sign of recovery.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_039',
    questionText: 'You smell gas near a vehicle wreck that has struck a gas meter or pipe. What should you do?',
    options: [
      'Search for the source of the leak and attempt to turn it off',
      'Move everyone away from the area immediately and call 999 and the national gas emergency line',
      'Only evacuate if you can see visible gas escaping',
      'Leave a window open in the vehicle to ventilate any gas inside',
    ],
    correctIndex: 1,
    explanation:
      'If you smell gas near a collision, evacuate all people immediately from the area. Call 999 and the National Gas Emergency line (0800 111 999). Do not use any electrical switches, mobile phones, or anything that could create a spark near the leak. Gas is invisible and can ignite explosively.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_040',
    questionText: 'How deep should chest compressions be during adult CPR?',
    options: [
      '2 to 3 centimetres',
      '5 to 6 centimetres',
      '8 to 10 centimetres',
      'As deep as possible without breaking the sternum',
    ],
    correctIndex: 1,
    explanation:
      'Adult CPR compressions should be 5 to 6 centimetres deep (approximately one-third of the chest depth). Push down firmly using the heel of your hand in the centre of the chest. Allow the chest to fully recoil between compressions. Rate: 100 to 120 per minute.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_041',
    questionText: 'A driver stops at a collision and finds a casualty who is bleeding from the leg. They have no bandages. What improvised materials can be used?',
    options: [
      'Engine oil from the vehicle to sterilise the wound before applying pressure',
      'Any clean, non-fluffy material such as a shirt or towel to apply direct pressure',
      'Nothing - wait for paramedics with sterile equipment to avoid infection risk',
      'Tape or rope tied tightly above the wound as a tourniquet',
    ],
    correctIndex: 1,
    explanation:
      'Clean, non-fluffy material - such as a T-shirt, towel, or scarf - can be used to apply direct pressure to a bleeding wound. Press firmly and maintain pressure without releasing. Infection is a secondary concern when the immediate risk is life-threatening haemorrhage. Paramedics will take over as soon as they arrive.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_042',
    questionText: 'A collision victim is conscious but says they cannot feel or move their legs. What does this suggest?',
    options: [
      'Temporary numbness from shock - it will resolve once they warm up',
      'Possible spinal cord injury - do not move them and call 999 immediately',
      'Poor circulation caused by blood loss - raise their legs immediately',
      'They need to be helped to stand so blood can flow to the legs',
    ],
    correctIndex: 1,
    explanation:
      'Loss of feeling or movement in the legs after a collision strongly suggests spinal cord damage. Keep the casualty absolutely still - any movement could worsen the injury. Call 999 immediately and instruct them not to move. Do not allow them to attempt to stand or be helped up.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_043',
    questionText: 'What is the purpose of an Automated External Defibrillator (AED) at a crash scene?',
    options: [
      'To provide electric shock therapy for severe bleeding',
      'To analyse heart rhythm and deliver a controlled shock to restore a normal heartbeat in cardiac arrest',
      'To measure vital signs and transmit them to ambulance control',
      'To provide oxygen to an unconscious casualty',
    ],
    correctIndex: 1,
    explanation:
      'An AED analyses the heart\'s rhythm and delivers an electric shock to restore a normal rhythm if cardiac arrest is caused by a shockable rhythm (ventricular fibrillation or pulseless VT). AEDs are designed for public use and provide voice instructions. Use one as soon as it is available alongside CPR.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_044',
    questionText: 'After a collision on a country road, the damaged vehicle is blocking the road. Can other vehicles be driven around it on the wrong side of the road?',
    options: [
      'No - vehicles should wait in a queue until the road is cleared by police',
      'Yes, if it is safe to do so and a lookout is posted to stop approaching traffic from the other direction',
      'Only emergency vehicles may drive on the wrong side of the road',
      'Yes, at normal speed - other road users will expect this',
    ],
    correctIndex: 1,
    explanation:
      'If the road is blocked, carefully managed passage on the wrong side of the road may be necessary and is generally accepted in these circumstances. However, it must be done slowly and only when safe, with someone signalling to stop approaching traffic from the other direction. Call 999 so police can manage the scene properly.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_045',
    questionText: 'What first aid should you apply for a suspected eye injury from broken glass at a crash scene?',
    options: [
      'Rinse the eye thoroughly with cold water to wash out the glass',
      'Do not touch or rinse the eye - cover it loosely with a clean dry pad and seek urgent medical help',
      'Ask the casualty to blink rapidly to try to dislodge any fragments naturally',
      'Apply antibiotic cream to prevent infection before covering',
    ],
    correctIndex: 1,
    explanation:
      'Do not attempt to remove glass from an eye or rinse it if an embedded object is suspected. Cover the eye loosely with a clean, dry pad or cup. Do not apply pressure. Seek urgent hospital treatment. Rubbing or rinsing an eye with embedded glass can cause further damage.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
  {
    id: 'ACE_046',
    questionText: 'What is the correct approach to a collision casualty who appears to be unconscious?',
    options: [
      'Assume they are sleeping and wait for them to respond naturally',
      'Shout loudly near them and tap their shoulders firmly to check responsiveness',
      'Immediately start CPR as any unconscious person has likely suffered cardiac arrest',
      'Move them away from the vehicle before checking their condition',
    ],
    correctIndex: 1,
    explanation:
      'Check responsiveness by shouting "Are you alright?" and gently tapping the shoulders. If there is no response, call 999. Then open the airway by tilting the head back and lifting the chin, check for normal breathing for up to 10 seconds. If not breathing normally, begin CPR.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_047',
    questionText: 'You find a casualty in a crashed car with their seatbelt still on. Should you remove it?',
    options: [
      'Yes, immediately - the belt may be causing chest compression',
      'Only remove it if the casualty needs to be moved or is at immediate risk from fire or flooding',
      'Always leave the seatbelt on until paramedics arrive',
      'Remove it only if the casualty is unconscious',
    ],
    correctIndex: 1,
    explanation:
      'Only remove the seatbelt if the casualty needs to be moved due to immediate danger (fire, flooding, etc.) or if CPR is required and the belt is preventing effective compressions. In all other cases, leave it in place as it may be helping to support an injured spine.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_048',
    questionText: 'At a crash scene, a bystander collapses and appears to be having a heart attack. What is the most important immediate action?',
    options: [
      'Lay them down, loosen their clothing, and offer reassurance until an ambulance arrives',
      'Call 999 immediately, start CPR if they become unresponsive and stop breathing normally, and use an AED if available',
      'Give them two aspirin tablets if available and get them to hospital by car',
      'Ask them to sit upright and breathe slowly to calm their heart rate',
    ],
    correctIndex: 1,
    explanation:
      'Call 999 immediately for a suspected heart attack. If the person becomes unresponsive and stops breathing normally, begin CPR at 100-120 compressions per minute. Attach and use an AED as soon as one is available. Early CPR and defibrillation significantly improve survival rates.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 2,
  },
  {
    id: 'ACE_049',
    questionText: 'What should you do after an emergency is resolved and you were involved in giving first aid at the scene?',
    options: [
      'Nothing further is required once paramedics have taken over',
      'Document everything you did for a first aid log',
      'Seek support if you feel emotionally affected - witnessing or dealing with trauma can have a lasting impact',
      'Report your actions to the DVLA within 7 days',
    ],
    correctIndex: 2,
    explanation:
      'Witnessing or responding to a serious collision can cause significant psychological distress. It is important to seek support if you feel affected - speak to friends, family, or your GP. Organisations such as the Samaritans or Trauma Support charities can also help. Do not dismiss your emotional response.',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 1,
  },
  {
    id: 'ACE_050',
    questionText: 'What does it mean if a casualty who was unconscious suddenly becomes agitated, aggressive, or confused?',
    options: [
      'They are recovering well and will return to normal shortly',
      'This can indicate a deteriorating brain injury and requires urgent medical attention',
      'They are suffering from panic and need to be firmly reassured',
      'It is a normal response to shock and should resolve when pain relief is given',
    ],
    correctIndex: 1,
    explanation:
      'Increasing confusion, agitation, or aggression after a period of unconsciousness in a head injury patient can indicate a serious and worsening brain injury. If 999 has not been called, do so immediately. Monitor the casualty\'s level of consciousness continuously using the AVPU scale (Alert, Voice, Pain, Unresponsive).',
    topicCategory: TopicCategory.AccidentsAndEmergencies,
    difficulty: 3,
  },
];
