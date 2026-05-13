// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const otherTypesQuestions: Question[] = [
  {
    id: 'OTV_001',
    questionText: 'A large lorry is signalling to turn left at a junction. Why should you not pass on its left?',
    options: [
      'Large vehicles have priority over smaller vehicles when turning',
      'The lorry may need to swing wide to the right before turning left, and could crush a vehicle on its left',
      'It is always illegal to pass on the left of any vehicle',
      'The lorry\'s rear overhang could strike a vehicle behind it',
    ],
    correctIndex: 1,
    explanation:
      'Large vehicles often need to move right before turning left to allow room for the rear of the trailer to clear the kerb. Never attempt to pass on the left of a long vehicle that is turning left - the gap can close rapidly.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_002',
    questionText: 'An emergency vehicle with blue flashing lights and a siren is approaching from behind on a dual carriageway. What should you do?',
    options: [
      'Speed up to clear the lane for the emergency vehicle',
      'Move left safely, reduce speed, and let it pass',
      'Stop immediately on the hard shoulder',
      'Maintain your current speed and lane position',
    ],
    correctIndex: 1,
    explanation:
      'Pull over to the left and reduce speed to allow emergency vehicles to pass. Do not mount kerbs or brake suddenly. On a motorway, do not stop on the hard shoulder unless directed to by blue flashing lights.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_003',
    questionText: 'Can you overtake a tram that has stopped at a tram stop?',
    options: [
      'Yes, provided no passengers are boarding or alighting',
      'Yes, always - trams follow their own lane',
      'No - you must wait behind the tram until it moves off',
      'Only when the tram doors are fully closed',
    ],
    correctIndex: 0,
    explanation:
      'You may pass a stationary tram on its left where the road allows, provided no passengers are boarding or alighting. If passengers are getting off, you must wait until they have cleared the road.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_004',
    questionText: 'A bus is indicating to pull away from a bus stop into your lane on a road with a 30mph limit. What should you do?',
    options: [
      'Always give way to a bus pulling out, as the law requires it',
      'Give way if it is safe to do so, as the Highway Code asks drivers to show courtesy',
      'Maintain your speed - the bus driver must wait for a safe gap',
      'Sound your horn to let the bus driver know you are passing',
    ],
    correctIndex: 1,
    explanation:
      'Highway Code Rule 223 asks drivers to give way to buses pulling out from bus stops where it is safe to do so. This is a courtesy requirement, not an absolute legal requirement, but refusing to give way when it is safe is inconsiderate.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_005',
    questionText: 'On a motorway, which lanes may a large HGV use?',
    options: [
      'Any lane, the same as a car',
      'Left and middle lanes only (lanes 1 and 2 on a 3-lane motorway)',
      'Left lane only at all times',
      'Any lane except the right-hand lane when towing',
    ],
    correctIndex: 1,
    explanation:
      'Vehicles over 7.5 tonnes are prohibited from using the right-hand lane on a motorway with three or more lanes. They may use lanes 1 and 2. This rule also applies to vehicles towing trailers.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_006',
    questionText: 'Why are motorcyclists particularly difficult to see at junctions and when changing lanes?',
    options: [
      'Motorcyclists do not use their headlights during the day',
      'Their narrow profile makes them harder to spot, especially in mirrors and blind spots',
      'Motorcycle engines are quieter than car engines',
      'Motorcyclists are allowed to ride in the blind spot area',
    ],
    correctIndex: 1,
    explanation:
      'Motorcycles have a much narrower profile than cars and can easily be obscured in mirrors or blind spots. Always look twice for motorcycles before pulling out or changing lanes. "Sorry, I didn\'t see them" is not a valid excuse.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_007',
    questionText: 'You are driving a long vehicle and need to turn right. Oncoming traffic is preventing you from completing the turn. What should you do?',
    options: [
      'Wait at the centre of the junction until oncoming traffic stops',
      'Sound your horn to ask oncoming traffic to give way',
      'Reverse and find an alternative route',
      'Move forward into the junction, wait in the turning position, and complete the turn when safe',
    ],
    correctIndex: 3,
    explanation:
      'When turning right across oncoming traffic, position at the centre line and wait for a safe gap. Long vehicles may need to wait in the junction but must ensure they do not cause a permanent blockage. Wait patiently for a safe opportunity to complete the turn.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_008',
    questionText: 'What is the maximum motorway speed for a bus or coach?',
    options: [
      '60mph',
      '65mph',
      '70mph',
      'The same as a car - 70mph',
    ],
    correctIndex: 0,
    explanation:
      'The maximum speed for a bus or coach on a motorway is 60mph. This is lower than the 70mph limit for cars to account for their heavier weight, higher centre of gravity, and greater stopping distances.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_009',
    questionText: 'Amber flashing lights on a vehicle or sign generally indicate what?',
    options: [
      'The vehicle is an emergency vehicle requiring you to stop',
      'The vehicle is slow-moving or there is a hazard ahead requiring caution',
      'The vehicle is indicating a turn and you should give way',
      'The vehicle is reversing and you must not proceed',
    ],
    correctIndex: 1,
    explanation:
      'Amber flashing lights warn of a slow-moving hazard. They are used on recovery vehicles, abnormal loads, motorway maintenance vehicles, and roadside warning signs. You should slow down and take care when you see amber warning lights.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_010',
    questionText: 'A motorcyclist is overtaking you on the right. At what point is it safe to turn right?',
    options: [
      'As soon as the motorcyclist\'s front wheel passes your vehicle',
      'Only after the motorcyclist has fully passed and is well ahead of you',
      'You can turn right provided you signal first',
      'Immediately - motorcyclists should not be overtaking near junctions',
    ],
    correctIndex: 1,
    explanation:
      'Wait until the motorcyclist has completely passed and is well clear before turning. A motorcyclist travelling at speed can close a gap very quickly. Turning into a motorcycle is one of the most common serious collision types.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_011',
    questionText: 'A very slow-moving tractor is ahead on a country road with no passing places. What is the safest approach?',
    options: [
      'Drive very closely behind so the tractor driver sees you and moves over',
      'Sound your horn regularly to encourage the tractor driver to pull in',
      'Drop back to maintain a safe following distance and wait for a safe overtaking opportunity',
      'Overtake when there is a gap in oncoming traffic, regardless of road markings',
    ],
    correctIndex: 2,
    explanation:
      'Be patient when following slow agricultural vehicles. Stay well back for a clear view of the road ahead and wait until it is completely safe to overtake - a clear straight road, no oncoming traffic, and no road markings prohibiting overtaking.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_012',
    questionText: 'You see a fire engine or ambulance at the roadside attending an incident. What should you do when passing?',
    options: [
      'Sound your horn so they are aware you are passing',
      'Slow down, take care, and pass at a safe reduced speed',
      'Maintain normal speed as emergency services are trained to work near traffic',
      'Stop completely until all emergency vehicles have left the scene',
    ],
    correctIndex: 1,
    explanation:
      'Pass stationary emergency services slowly and with care. Emergency workers are operating in a dangerous environment close to live traffic. Many countries operate a "Move Over" law - in the UK, take great care and slow right down.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_013',
    questionText: 'What do three short blasts of a horn from a large vehicle usually signify?',
    options: [
      'The driver is warning you not to overtake',
      'This is not a standard recognised signal in the Highway Code',
      'The driver is indicating they are reversing',
      'The driver is warning of a hazard ahead',
    ],
    correctIndex: 1,
    explanation:
      'Three short blasts is not a standardised Highway Code signal. The horn should only be used to warn of presence. Do not interpret unofficial horn sequences as instructions - they are not part of the recognised signalling system.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_014',
    questionText: 'Cyclists are allowed to use which lanes on a road?',
    options: [
      'Only dedicated cycle lanes',
      'Any part of the road, including the main carriageway, unless signed otherwise',
      'Only the left-hand lane of a dual carriageway',
      'The pavement when there is no dedicated cycle lane',
    ],
    correctIndex: 1,
    explanation:
      'Cyclists are permitted to ride on any part of the road unless signs indicate otherwise. They do not have to use cycle lanes if they are present. Cyclists riding in the primary position (middle of the lane) can do so legitimately to increase their visibility.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_015',
    questionText: 'What is the purpose of an "abnormal load" escort vehicle?',
    options: [
      'To carry spare parts for the oversized vehicle in case of breakdown',
      'To warn other road users of the wide or long load ahead and assist with traffic management',
      'To enforce the special speed restrictions that apply to all large vehicles',
      'To provide communications between the load driver and the police',
    ],
    correctIndex: 1,
    explanation:
      'Escort vehicles accompany abnormal (oversized) loads to warn other road users that an unusually wide or long vehicle is ahead. They help manage traffic at junctions and ensure the load can complete its route safely.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_016',
    questionText: 'Why is it important to remember that trams cannot steer around obstacles in the road?',
    options: [
      'Trams travel faster than other vehicles so need more warning',
      'Trams are fixed to their rails and cannot deviate from their track',
      'Tram drivers are not permitted to sound a warning horn',
      'Trams have a much longer stopping distance than any other vehicle',
    ],
    correctIndex: 1,
    explanation:
      'Trams run on fixed rails and have no ability to steer around hazards. If a vehicle, cyclist, or pedestrian is in the tram\'s path, the tram cannot avoid them. You must never stop in a tram lane or on tram tracks.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_017',
    questionText: 'Why do motorcyclists often ride with their headlight on during daylight hours?',
    options: [
      'It is a legal requirement for all motorcycles manufactured after 2004',
      'To increase their visibility to other road users',
      'To power the motorcycle\'s electronic systems',
      'They are required to do so only in poor weather conditions',
    ],
    correctIndex: 1,
    explanation:
      'Riding with the headlight on during the day makes motorcycles more conspicuous and reduces the risk of other drivers failing to see them. Many modern motorcycles have automatic daytime running lights. This is a recognised safety measure encouraged by the Highway Code.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_018',
    questionText: 'A lorry driver has a large blind spot on the nearside (left) of their cab. What does this mean for a car driver?',
    options: [
      'The lorry will always indicate before moving left',
      'The lorry driver may be unable to see a car travelling alongside on the left',
      'Car drivers should always travel on the offside of a lorry',
      'Lorry drivers are required by law to check mirrors every 5 seconds',
    ],
    correctIndex: 1,
    explanation:
      'Large vehicles have significant blind spots, particularly on the nearside where the cab height prevents the driver from seeing vehicles close alongside. Avoid lingering in a lorry\'s blind spot - if you cannot see the driver\'s mirrors, they cannot see you.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_019',
    questionText: 'Why are tram rails especially dangerous for cyclists and motorcyclists?',
    options: [
      'Tram rails carry an electric charge that could affect tyres',
      'Tram rails are raised above the road surface causing vehicles to bounce',
      'Narrow tyres can get caught in the rails, and the smooth metal surface is very slippery when wet',
      'Tram rails force cyclists and motorcyclists to slow to walking pace',
    ],
    correctIndex: 2,
    explanation:
      'Tram rails are hazardous for powered two-wheelers and cyclists. Narrow tyres can slot into the groove and cause the rider to lose control. The smooth metal rails also become extremely slippery in wet conditions. Cross rails at as close to a right angle as possible to minimise risk.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_020',
    questionText: 'An emergency vehicle behind you is sounding its siren and showing blue flashing lights, but you are at a red traffic light. What should you do?',
    options: [
      'Immediately drive through the red light to clear the way',
      'Stay where you are - the emergency vehicle will find a way around',
      'Move forward only if it is safe to do so without endangering pedestrians or other traffic',
      'Switch on your hazard lights and reverse to make space',
    ],
    correctIndex: 2,
    explanation:
      'Do not automatically drive through a red light for an emergency vehicle. If you can move forward safely without crossing into the path of pedestrians or other vehicles, do so. If not, stay put - emergency vehicle drivers are trained to navigate through junctions. Running a red light is still an offence even when making way for emergency services.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_021',
    questionText: 'Can motorcycles use bus lanes in the UK?',
    options: [
      'Never - bus lanes are exclusively for buses and taxis',
      'Only between the hours of 11pm and 5am',
      'It depends on the local authority - some bus lanes are open to motorcycles as shown on the signs',
      'Yes, motorcycles may always use bus lanes',
    ],
    correctIndex: 2,
    explanation:
      'Whether motorcycles can use a bus lane depends on the sign at that location. Some bus lanes in the UK are open to motorcycles (and cyclists/taxis) as indicated on the lane entry signs. Always check the sign - if motorcycles are not listed, they cannot use the lane during restricted hours.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_022',
    questionText: 'What is the national speed limit for a motorcycle on a motorway?',
    options: [
      '60mph',
      '65mph',
      '70mph',
      '80mph',
    ],
    correctIndex: 2,
    explanation:
      'The national speed limit for a motorcycle on a motorway is 70mph - the same as for a car. There is no separate lower limit for motorcycles on motorways. However, learner motorcyclists are not permitted on motorways.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_023',
    questionText: 'A long vehicle in front is waiting to turn right. Why might it move to the left first?',
    options: [
      'The driver is about to overtake a parked vehicle',
      'Long vehicles are required to keep left until the junction',
      'The vehicle needs extra space to swing wide enough to complete the right turn safely',
      'The driver is confused about the route',
    ],
    correctIndex: 2,
    explanation:
      'Long vehicles sometimes move left before a right turn to allow the rear of the vehicle enough room to swing through the junction without mounting the kerb. Do not assume they are turning left - wait and observe before reacting.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_024',
    questionText: 'From which directions can trams approach at a tramway crossing?',
    options: [
      'Only from the left, as they follow a one-way system',
      'From either direction, including the same direction as traffic on your side of the road',
      'Only from the same direction as other road traffic',
      'Only from the right, as trams travel on the right-hand rail',
    ],
    correctIndex: 1,
    explanation:
      'Trams can approach from either direction and may travel in the same direction as the traffic around them. Unlike normal road traffic, trams can also travel in the opposite direction on a two-way tramway. Always check both ways before crossing tram tracks.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_025',
    questionText: 'How should you pass a horse-drawn vehicle on a country road?',
    options: [
      'Sound your horn briefly as you approach so the horse is aware of you',
      'Pass quickly to minimise the time the horse is alongside your vehicle',
      'Slow right down, pass wide and slowly, and do not rev your engine',
      'Flash your headlights to warn the rider you are approaching',
    ],
    correctIndex: 2,
    explanation:
      'Horses can be startled by sudden noise, engine revving, or vehicles passing closely at speed. Slow well down before reaching the horse, give it as much room as possible, and pass slowly and quietly. Revving the engine or sounding the horn can cause the horse to bolt.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_026',
    questionText: 'What is the speed limit for a car towing a caravan on a dual carriageway?',
    options: [
      '50mph',
      '60mph',
      '65mph',
      '70mph',
    ],
    correctIndex: 1,
    explanation:
      'A car towing a caravan or trailer is limited to 60mph on a dual carriageway, not the usual 70mph national limit. On a single carriageway the limit is 50mph. These limits apply regardless of the posted speed limit (unless it is lower).',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_027',
    questionText: 'A recovery vehicle is parked on the hard shoulder of a motorway with its amber beacon flashing. What does this tell you?',
    options: [
      'The vehicle is about to pull onto the motorway and you must stop',
      'There is a slow-moving or stopped vehicle ahead - reduce speed and take care',
      'You should move to the middle lane immediately',
      'The vehicle is directing traffic to exit at the next junction',
    ],
    correctIndex: 1,
    explanation:
      'Amber flashing beacons indicate a slow-moving or stopped hazard. A recovery vehicle on the hard shoulder means there may be a breakdown scenario with people working near live traffic. Reduce your speed, move into a safer lane if possible, and pass with care.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_028',
    questionText: 'Following a large lorry in wet weather, you notice heavy spray from its rear wheels. What is the main risk?',
    options: [
      'The spray may contain chemicals that damage your paintwork',
      'The spray drastically reduces your forward visibility, making it hard to see hazards ahead',
      'The spray increases the lorry\'s stopping distance',
      'The spray will wet your windscreen wipers, reducing their effectiveness',
    ],
    correctIndex: 1,
    explanation:
      'Heavy spray from lorries in wet weather can severely reduce visibility for following drivers. Increase your following distance significantly, use your windscreen wipers and dipped headlights, and be patient. Drop back until you have a clear view of the road ahead.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_029',
    questionText: 'What does CBT stand for in the context of motorcycling?',
    options: [
      'Compulsory Basic Training',
      'Competency Bike Test',
      'Comprehensive Bike Theory',
      'Certified Biker Training',
    ],
    correctIndex: 0,
    explanation:
      'CBT stands for Compulsory Basic Training. It is a course that must be completed before riding a moped or motorcycle on public roads as a learner. It covers basic controls and on-road riding. A CBT certificate is valid for 2 years.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_030',
    questionText: 'Is it legal for a motorcyclist to filter through slow-moving or stationary traffic?',
    options: [
      'No - overtaking on either side of stationary traffic is always illegal',
      'Yes - filtering is legal provided it is done safely and at a reasonable speed',
      'Only on roads with a speed limit of 30mph or less',
      'Only when using a dedicated motorcycle lane',
    ],
    correctIndex: 1,
    explanation:
      'Filtering - riding between lanes of slow or stationary traffic - is legal in the UK provided it is done safely and at an appropriate speed. Highway Code Rule 88 acknowledges filtering. However, motorcyclists must not filter at unsafe speeds or in situations where it is dangerous to do so.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_031',
    questionText: 'You are in a group of motorcyclists riding together. Why should you not ride directly behind the rider in front in a single line?',
    options: [
      'Riding in a single line is not permitted for motorcycles on motorways',
      'Riding too close in a line reduces your view ahead and your reaction time if the lead rider brakes',
      'It is safer to ride two abreast so cars can see the group more clearly',
      'You must leave a gap in case the lead motorcyclist needs to reverse',
    ],
    correctIndex: 1,
    explanation:
      'In a group, maintain the same following distance as you would to any vehicle - about 2 seconds in good conditions, more in poor conditions. Riding too closely in a line means you cannot see hazards ahead or react in time if the rider in front brakes suddenly. A staggered formation is often used.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_032',
    questionText: 'A police officer or traffic warden signals you to pull over and stop. What should you do?',
    options: [
      'Continue at the same speed and wait for them to use their loudspeaker',
      'Indicate, pull over safely to the left, and stop as soon as it is safe',
      'Stop immediately wherever you are, even if in a hazardous position',
      'Drive to the nearest car park before stopping',
    ],
    correctIndex: 1,
    explanation:
      'When directed to stop by a police officer or authorised person, indicate left, pull over safely, and stop as soon as you safely can. Failing to stop when directed is a criminal offence. Do not stop suddenly in a dangerous position - signal your intention and find a safe place to pull over.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_033',
    questionText: 'You notice a large fuel tanker leaking liquid from its rear. What should you do?',
    options: [
      'Overtake quickly to get away from it and alert the driver',
      'Stay close behind it to observe the leak and call for help when safe to do so',
      'Keep well back, do not overtake, warn other drivers if safe, and call the emergency services',
      'Alert the driver by flashing your headlights and sounding your horn',
    ],
    correctIndex: 2,
    explanation:
      'A leaking fuel tanker presents an extreme fire and explosion risk. Stay well back, do not attempt to overtake (sparks or heat from your vehicle could ignite fumes), warn other drivers if it is safe to do so, and contact the emergency services immediately. Do not attempt to stop the tanker yourself.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_034',
    questionText: 'A large lorry is reversing across the road and blocking your path. What should you do?',
    options: [
      'Sound your horn continuously to make the driver stop reversing',
      'Reverse away from the lorry, wait, and allow it to complete the manoeuvre',
      'Drive around the front of the lorry at speed to clear the obstruction',
      'Get out of your vehicle and direct the lorry driver',
    ],
    correctIndex: 1,
    explanation:
      'When a large vehicle is reversing and blocking your path, stop, reverse to give it more room if needed, and wait patiently for it to complete the manoeuvre. Do not attempt to squeeze past - the driver may not be able to see your vehicle and could cause a collision.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_035',
    questionText: 'A bus has stopped at a bus stop. Elderly passengers are slowly getting off. What should you do?',
    options: [
      'Sound your horn gently so the passengers know a vehicle is waiting',
      'Overtake the bus quickly on the right to avoid delay',
      'Be patient, stay back, and be alert for passengers who may step into the road',
      'Flash your lights to warn passengers not to step out in front of you',
    ],
    correctIndex: 2,
    explanation:
      'Passengers, especially elderly or disabled people, may step into the road without looking after getting off a bus. Be patient, stay well back so you can see around the bus, and be ready to stop if anyone steps into your path. Never overtake a bus at a stop on the left where passengers may be crossing.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_036',
    questionText: 'A driver transporting passengers for hire or reward in a vehicle with 9 or more seats (including the driver) requires which additional licence entitlement?',
    options: [
      'Category B+ (extended car licence)',
      'Category D (passenger carrying vehicle licence)',
      'Category C (large goods vehicle licence)',
      'No additional licence - a standard car licence is sufficient',
    ],
    correctIndex: 1,
    explanation:
      'Driving a bus or minibus with 9 or more seats (including the driver) for hire or reward requires a Category D passenger carrying vehicle (PCV) licence. Driving without the correct licence is illegal and invalidates insurance.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_037',
    questionText: 'What is the maximum speed limit for a car and caravan combination on a single carriageway road?',
    options: [
      '40mph',
      '50mph',
      '60mph',
      '70mph',
    ],
    correctIndex: 1,
    explanation:
      'A car towing a caravan or trailer has a maximum speed of 50mph on a single carriageway and 60mph on a dual carriageway or motorway. These limits exist because towing combinations have longer stopping distances and are less stable at high speeds.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_038',
    questionText: 'Which emergency services use red warning lights as well as blue?',
    options: [
      'Police vehicles always show red lights at the rear',
      'Fire engines use both red and blue flashing lights',
      'Ambulances only use red lights when reversing',
      'Red flashing lights are used by vehicles attending level crossings',
    ],
    correctIndex: 1,
    explanation:
      'Fire engines in the UK display both blue and red flashing warning lights. Blue lights are used by police, ambulances, and fire service. The combination of colours helps other road users identify fire engines specifically. Red lights at the rear should not be confused with brake lights.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_039',
    questionText: 'On a three-lane motorway, which vehicles are prohibited from using the right-hand (outside) lane?',
    options: [
      'Motorcycles with engine sizes below 125cc',
      'Vehicles over 7.5 tonnes and vehicles towing trailers',
      'All vehicles during peak traffic hours',
      'Any vehicle travelling below 60mph',
    ],
    correctIndex: 1,
    explanation:
      'On a three-lane (or more) motorway, vehicles over 7.5 tonnes maximum authorised mass (MAM) and all vehicles towing trailers are prohibited from using the right-hand lane. They must use only the two left-hand lanes. This rule does not apply if there are only two lanes.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_040',
    questionText: 'Why should you allow a larger following distance when riding a motorcycle compared to driving a car in the same conditions?',
    options: [
      'Motorcycles have shorter stopping distances so need more warning time',
      'Motorcycles are less stable and a pothole or debris that a car would ride over could cause a motorcycle to crash',
      'Motorcycles always travel faster than cars on open roads',
      'Motorcyclists are legally required to maintain a 4-second gap at all times',
    ],
    correctIndex: 1,
    explanation:
      'Motorcycles are much more vulnerable to road surface hazards such as potholes, loose gravel, diesel spills, and wet drain covers. A larger following distance gives the motorcyclist more time to spot these hazards and take evasive action, whereas a car might drive over them without incident.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_041',
    questionText: 'Why does a long vehicle such as an articulated lorry take much longer to overtake than a car?',
    options: [
      'Long vehicles are legally restricted to slower speeds when overtaking',
      'Because of their length, they need to travel much further alongside the vehicle being overtaken before the pass is complete',
      'Long vehicle drivers must signal for 5 seconds before overtaking',
      'Long vehicles cannot accelerate quickly enough to complete an overtake',
    ],
    correctIndex: 1,
    explanation:
      'The sheer length of an articulated lorry means it must travel a much greater distance to complete an overtaking manoeuvre. A vehicle being overtaken must not speed up during the pass. Give way to long vehicles that have already committed to an overtake to allow the manoeuvre to complete safely.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_042',
    questionText: 'You meet a large lorry on a narrow lane where there is not enough room for both vehicles to pass. Who should give way?',
    options: [
      'The lorry, because large vehicles must always give way to smaller ones',
      'The vehicle travelling uphill, as the vehicle going downhill has priority',
      'Whoever finds a passing place or space to pull aside first, or the vehicle nearest a passing place',
      'The vehicle that is travelling on the left side of the road',
    ],
    correctIndex: 2,
    explanation:
      'There is no blanket rule that lorries must give way. Common sense applies: the vehicle nearest a passing place should use it, or the vehicle that can most easily pull aside should do so. Courtesy and practical consideration for which vehicle is easier to manoeuvre should guide the decision.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_043',
    questionText: 'A parked ambulance has no lights or sirens active. Do you need to treat it differently from any other parked vehicle?',
    options: [
      'Yes - always leave a 3-metre gap when passing any emergency vehicle',
      'No - a stationary ambulance with no active warnings is treated like any other parked vehicle',
      'Yes - you must stop and check if assistance is needed',
      'Yes - you must not park within 20 metres of it',
    ],
    correctIndex: 1,
    explanation:
      'An ambulance (or any emergency vehicle) that is stationary and not displaying active warning lights or sounding a siren is not on an active emergency call and should be treated like any other parked vehicle. Normal road rules apply. However, always be aware that crew members may be nearby.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_044',
    questionText: 'Are cyclists allowed to ride on a dual carriageway?',
    options: [
      'No - cyclists are prohibited from dual carriageways',
      'Only if they are accompanied by a motor vehicle escort',
      'Yes - unless signs specifically prohibit cycling on that particular road',
      'Only on the hard shoulder or cycle lane adjacent to the dual carriageway',
    ],
    correctIndex: 2,
    explanation:
      'Cyclists are generally permitted to ride on dual carriageways unless signs specifically prohibit it (as they do on motorways). However, it is not recommended without good reason due to the high speeds involved. Some dual carriageways have adjacent cycle paths as a safer alternative.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_045',
    questionText: 'When should you give a long, powerful blast of your horn at another road user?',
    options: [
      'To warn them that you intend to overtake',
      'When they have cut you up or done something dangerous',
      'When you are reversing a large vehicle',
      'You should not use the horn in anger or aggression - it should only warn others of your presence',
    ],
    correctIndex: 3,
    explanation:
      'The horn must only be used to warn other road users of your presence. It must not be used to express frustration or anger, to rebuke another driver, or as a signal of intent to overtake. Using the horn aggressively is both illegal and potentially dangerous. HC Rule 112 states you must not use the horn while stationary or in a built-up area between 11.30pm and 7am.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_046',
    questionText: 'What is the minimum age for riding a moped (up to 50cc) on public roads in the UK?',
    options: [
      '14',
      '15',
      '16',
      '17',
    ],
    correctIndex: 2,
    explanation:
      'The minimum age for riding a moped (engine up to 50cc, maximum speed 45km/h) on public roads in the UK is 16. Riders must hold a provisional licence, have completed their CBT, and display L-plates. They are limited to 30mph and may not carry passengers or use motorways.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_047',
    questionText: 'A motorcyclist in front of you suddenly swerves to one side of their lane. What is the most likely reason?',
    options: [
      'They are signalling to turn without using their indicators',
      'They are avoiding a hazard in the road such as a pothole, drain cover, or debris',
      'They have lost concentration momentarily',
      'They are making room for you to overtake',
    ],
    correctIndex: 1,
    explanation:
      'Motorcyclists often swerve to avoid road surface hazards that cars would drive over without noticing - potholes, raised drain covers, loose gravel, or diesel spills. If you see a motorcyclist swerve, be alert for the hazard they avoided and give them extra space.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 1,
  },
  {
    id: 'OTV_048',
    questionText: 'What sign on a vehicle indicates it is carrying a load that extends beyond 18.65 metres in length?',
    options: [
      'A red and white striped hazard board',
      'Amber and black "LONG VEHICLE" marker boards at the rear',
      'A flashing green light at the front',
      'A white flag on the overhanging load',
    ],
    correctIndex: 1,
    explanation:
      'Vehicles carrying loads that make the overall combination longer than 18.65 metres must display "LONG VEHICLE" marker boards at the rear. These yellow boards with black text and chevrons alert following drivers to the exceptional length. Additional lighting may also be required.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 3,
  },
  {
    id: 'OTV_049',
    questionText: 'An unmarked police car signals you to pull over by illuminating a sign saying "POLICE - FOLLOW" in its rear window. What should you do?',
    options: [
      'Ignore it as unmarked vehicles have no authority to stop traffic',
      'Acknowledge the signal, indicate left, and pull over safely when you can',
      'Stop immediately wherever you are',
      'Continue to the nearest police station',
    ],
    correctIndex: 1,
    explanation:
      'Unmarked police vehicles are legally authorised to stop drivers. If signalled to stop by an unmarked police car, acknowledge the signal, indicate left, and pull over safely when it is appropriate. If you have concerns about whether it is genuine, you can drive to a busy public place before stopping and call 999 to verify.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
  {
    id: 'OTV_050',
    questionText: 'A heavy lorry is travelling slowly uphill on a single carriageway road. Several vehicles are queuing behind it. What should you do?',
    options: [
      'Sound your horn to encourage the lorry driver to pull over',
      'Overtake as quickly as possible using any available gap in oncoming traffic',
      'Be patient, hang back to improve your view, and only overtake when it is completely safe and legal',
      'Flash your headlights to alert the driver that vehicles are queuing',
    ],
    correctIndex: 2,
    explanation:
      'Patience is essential when following a slow-moving heavy vehicle uphill. Stay well back for a better view of the road ahead. Only overtake when you can see clearly that the road is straight, there are no prohibiting markings, there is no oncoming traffic, and you have sufficient speed and distance to complete the overtake safely.',
    topicCategory: TopicCategory.OtherTypes,
    difficulty: 2,
  },
];
