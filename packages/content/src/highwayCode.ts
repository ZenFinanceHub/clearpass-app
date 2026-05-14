export interface HCRule {
  ruleNumber: number;
  title: string;
  content: string;
}

export interface HCChapter {
  id: string;
  chapterNumber: number;
  title: string;
  ruleRange: string;
  summary: string;
  rules: HCRule[];
  keyPoints: string[];
}

export const highwayCodeChapters: HCChapter[] = [
  {
    id: 'ch1',
    chapterNumber: 1,
    title: 'Rules for Pedestrians',
    ruleRange: 'Rules 1-35',
    summary:
      'Covers how pedestrians should behave on roads and pavements, including how to cross safely, use crossings, and stay visible at night. Also covers special situations such as pedestrianised areas and organised walks.',
    keyPoints: [
      'Always use the footway or footpath when one is available',
      'Use the Green Cross Code to cross safely: find a safe place, stop, look all around and listen, wait until it is safe, walk across',
      'At pelican crossings, wait for the green figure before crossing and keep looking for traffic',
      'Wear or carry something light-coloured or reflective when walking at night',
      'Organised walking groups should use the footpath where possible; walk in single file on narrow roads at night',
    ],
    rules: [
      {
        ruleNumber: 1,
        title: 'Pavements and footways',
        content:
          'Where a pavement or footway is provided, use it. If a pavement is not available, keep to the right-hand side of the road so you can see oncoming traffic. Exceptions include where a right-hand verge is safer due to a bend in the road or oncoming hazard.',
      },
      {
        ruleNumber: 2,
        title: 'Footpaths and cycle tracks',
        content:
          'Take care when walking on a path shared with cyclists. Keep to the pedestrian side where the path is divided. Be aware of cyclists approaching from behind and give them space.',
      },
      {
        ruleNumber: 3,
        title: 'Crossing near junctions',
        content:
          'When crossing near a junction, look out for vehicles turning into the road. If you have started to cross and traffic wants to pass, you have priority — but make eye contact with drivers before stepping out.',
      },
      {
        ruleNumber: 4,
        title: 'Organised walks',
        content:
          'Groups should use the footpath where possible. If walking on the road, keep to the left in a column and where the road is narrow, walk in single file. In the dark, carry a light visible from front and rear and wear or carry reflective materials.',
      },
      {
        ruleNumber: 7,
        title: 'Crossing the road — the Green Cross Code',
        content:
          'First find a safe place to cross. Then stop at the kerb. Look all around for traffic and listen. If traffic is coming, let it pass. Look all around again. When it is safe, walk straight across the road. Keep looking and listening as you cross.',
      },
      {
        ruleNumber: 8,
        title: 'Crossing at junctions, in queues, at night',
        content:
          'Watch out for traffic turning at corners. At night, take extra care: wear something light-coloured or carry a torch. Be seen by wearing reflective clothing or accessories.',
      },
      {
        ruleNumber: 17,
        title: 'Zebra crossings',
        content:
          'Traffic should give way to pedestrians already on a zebra crossing. Pedestrians should not step out into the road without looking first — a vehicle may not be able to stop in time. Make eye contact with drivers. Cross within the zig-zag lines.',
      },
      {
        ruleNumber: 21,
        title: 'Pelican crossings',
        content:
          'Wait for the green figure to appear before crossing. If the green figure is flashing, do not start to cross — if already crossing, keep going. Press the button to request the signal to change.',
      },
      {
        ruleNumber: 25,
        title: 'Toucan crossings',
        content:
          'Toucan crossings allow both cyclists and pedestrians to cross at the same time. They are signal-controlled. Unlike pelican crossings, there is no flashing amber phase.',
      },
      {
        ruleNumber: 26,
        title: 'Pegasus (equestrian) crossings',
        content:
          'Pegasus crossings are for horse riders. They have a higher button for use from horseback. Pedestrians may also use these crossings but should be aware of horses.',
      },
      {
        ruleNumber: 27,
        title: 'Puffin crossings',
        content:
          'Puffin crossings detect pedestrians waiting on the pavement and those crossing, adjusting the signal timing accordingly. The demand and push-button box are on the near side, unlike pelican crossings.',
      },
      {
        ruleNumber: 35,
        title: 'Crossing at level crossings',
        content:
          'Never start to cross at a level crossing when the red lights are flashing or the alarm is sounding. If caught on a crossing, get everyone off immediately and clear of the barrier. Only cross when the lights go out and barriers open, or when a manually-operated crossing keeper signals it is safe.',
      },
    ],
  },
  {
    id: 'ch2',
    chapterNumber: 2,
    title: 'Rules for Users of Powered Wheelchairs and Mobility Scooters',
    ruleRange: 'Rules 36-46',
    summary:
      'Sets out the rules for people using powered wheelchairs and Class 2 or Class 3 mobility scooters on roads and pavements, including speed limits, lighting, and where they may be used.',
    keyPoints: [
      'Class 2 scooters (max 4mph) are for pavement use and may also use the road',
      'Class 3 scooters (max 8mph) may use the road; 4mph on pavements',
      'Lights are required on Class 3 vehicles when used on the road at night',
      'You must not use a powered wheelchair or scooter on motorways',
      'You should be competent to use the vehicle safely in traffic',
    ],
    rules: [
      {
        ruleNumber: 36,
        title: 'Categories of powered wheelchairs and scooters',
        content:
          'There are two main categories: Class 2 (maximum speed 4mph, for pavement use) and Class 3 (maximum speed 8mph on the road, 4mph on the pavement). Class 3 vehicles must be registered with the DVLA and must display a nil-rate tax disc.',
      },
      {
        ruleNumber: 39,
        title: 'On pavements',
        content:
          'Powered wheelchairs and scooters may be used on pavements and footways. When on the pavement, the maximum speed is 4mph. Take care not to endanger or inconvenience pedestrians. Be aware of pedestrians with sight or hearing impairments who may not see or hear you.',
      },
      {
        ruleNumber: 42,
        title: 'On the road',
        content:
          'Class 3 vehicles may use the road. When doing so, keep as close to the left as possible. You should not use the road if you are unable to use it safely. Avoid using the road at night or in poor visibility unless your vehicle is equipped with appropriate lights and reflectors.',
      },
      {
        ruleNumber: 43,
        title: 'Lighting requirements',
        content:
          'Class 3 vehicles used on the road must have: a front white light, a rear red light, a rear red reflector, and an amber flashing light if travelling above walking pace. These are required during the hours of darkness and in poor visibility.',
      },
      {
        ruleNumber: 45,
        title: 'Prohibited roads',
        content:
          'Powered wheelchairs and scooters must not be used on motorways, or on roads where signs prohibit their use. They may use cycle tracks provided they are not excluded by a specific sign or local authority restriction.',
      },
    ],
  },
  {
    id: 'ch3',
    chapterNumber: 3,
    title: 'Rules About Animals',
    ruleRange: 'Rules 47-58',
    summary:
      'Covers the rules for people in charge of animals on or near roads, including horses and livestock. Also includes guidance for drivers when passing animals.',
    keyPoints: [
      'When riding a horse, wear appropriate clothing including a correctly fitted helmet',
      'Keep horses to the left of the road; never take animals on motorways',
      'Never leave animals in vehicles where they could suffer distress or danger',
      'Drivers should slow down and give horses plenty of room — do not rev engines or sound the horn',
      'Livestock must not be driven along roads without taking proper precautions',
    ],
    rules: [
      {
        ruleNumber: 47,
        title: 'Horse riders — general',
        content:
          'Riders should: wear appropriate protective clothing including a correctly fitted helmet; keep to the left; be aware of other road users. Never ride a horse in an uncontrolled way or without adequate skill.',
      },
      {
        ruleNumber: 49,
        title: 'Horse riders on the road',
        content:
          'Horses and riders should keep to the left. A leading horse should be on the left of the lead horse when riding in a pair. Alert other road users to the presence of horses. Avoid riding on pavements, footpaths, or cycle tracks.',
      },
      {
        ruleNumber: 50,
        title: 'Riding at night',
        content:
          'At night or in poor visibility, horse riders should wear reflective clothing and avoid busy roads. Horse riders may lead or ride a horse in the dark, but must take extra precautions to be visible.',
      },
      {
        ruleNumber: 52,
        title: 'Drivers and horses',
        content:
          'When you see a horse on the road, slow down and pass wide and slowly. Do not frighten the animal by revving the engine, sounding the horn, or playing loud music. Be prepared for the horse to react unpredictably. After passing, accelerate gently away.',
      },
      {
        ruleNumber: 53,
        title: 'Animals in vehicles',
        content:
          'When transporting animals in a vehicle, make sure they are suitably restrained so they cannot distract the driver or cause injury. Never leave an animal unattended in a vehicle in conditions where it could suffer. In hot weather, an animal can die within minutes in a hot car.',
      },
      {
        ruleNumber: 57,
        title: 'Livestock on the road',
        content:
          'Livestock must not be driven along roads without proper precautions. Ensure appropriate control of the animals, use a dog if necessary, and ensure the animals do not stray onto footways. Place warning signs or have helpers to alert approaching traffic.',
      },
    ],
  },
  {
    id: 'ch4',
    chapterNumber: 4,
    title: 'Rules for Cyclists',
    ruleRange: 'Rules 59-82',
    summary:
      'Covers the rules all cyclists must follow, including equipment requirements, road positioning, junctions, roundabouts, and the use of cycle facilities. Includes the 2022 updated hierarchy of road users.',
    keyPoints: [
      'Wear a cycle helmet (strongly recommended but not a legal requirement)',
      'Use lights at night — white at front, red at rear; a red rear reflector is required by law',
      'Ride in the "primary position" (centre of lane) to be more visible where appropriate',
      'Cyclists may ride two abreast — they should ride single file on narrow or busy roads',
      'Do not cycle on the pavement unless a signed shared path permits it',
    ],
    rules: [
      {
        ruleNumber: 59,
        title: 'Clothing and equipment',
        content:
          'You should wear a correctly fitted cycle helmet. Wear something bright or fluorescent in poor visibility. Wear reflective clothing and accessories at night. Consider high-visibility gloves to make hand signals more visible.',
      },
      {
        ruleNumber: 60,
        title: 'Cycle lighting',
        content:
          'At night and in poor visibility you must use: a white front light (may be flashing), a red rear light (may be flashing), and a red rear reflector. You may also use additional lighting. Amber pedal reflectors are required on cycles manufactured after 1985.',
      },
      {
        ruleNumber: 62,
        title: 'Cycle routes and lanes',
        content:
          'Use cycle routes, lanes, and tracks where they make your journey safer and easier. They are not compulsory. Cycle lanes are marked by a white line (sometimes broken) and "CYCLE LANE" markings. Advisory lanes have broken lines; mandatory lanes have solid lines.',
      },
      {
        ruleNumber: 66,
        title: 'Cycling on roads',
        content:
          'Keep both hands on the handlebar except when signalling or operating controls. Ride in the centre of the lane in slower traffic to be seen; at other times ride at least 0.5 metres from the kerb. Avoid pavement riding. Do not carry passengers unless the cycle is built for it.',
      },
      {
        ruleNumber: 67,
        title: 'Cycle lanes and tracks',
        content:
          'When using a cycle lane marked with a broken white line, you may leave the lane if necessary but should avoid doing so in busy conditions. Never cycle on the pavement unless a shared-use sign indicates it is permitted.',
      },
      {
        ruleNumber: 72,
        title: 'Junctions',
        content:
          'At junctions, take extra care, especially when turning right. When turning right, wait until there is a safe gap in the traffic. Use the advanced stop line (ASL) where available. Watch out for long vehicles that may swing wide.',
      },
      {
        ruleNumber: 73,
        title: 'Advanced stop lines (ASLs)',
        content:
          'Advanced stop lines allow cyclists to position themselves ahead of other traffic at traffic lights, improving visibility and allowing cyclists to move off first. Motorists must not enter the area unless the signal is green and they cannot stop safely.',
      },
      {
        ruleNumber: 75,
        title: 'Road positioning',
        content:
          'Cyclists should ride at least 0.5m from the kerb edge (or a car door\'s width from parked cars) to avoid hazards. In slow-moving traffic, ride near the centre of the lane to be more visible. On fast or wide roads, keep left. Where it would be unsafe for a vehicle to overtake, ride in the centre of the lane ("primary position").',
      },
      {
        ruleNumber: 76,
        title: 'Riding two abreast',
        content:
          'Cyclists may ride two abreast and it can be safer to do so, particularly in groups or on busy roads. When riding two abreast, be aware of the needs of other road users. Move into single file when appropriate, such as on narrow roads or where traffic is passing.',
      },
      {
        ruleNumber: 82,
        title: 'Cycling at night',
        content:
          'At night, ensure your lights are working and that you are visible. Plan your route carefully. Use cycle tracks where available. Wear reflective clothing and consider a high-visibility vest. Be aware that your visibility to drivers is significantly reduced.',
      },
    ],
  },
  {
    id: 'ch5',
    chapterNumber: 5,
    title: 'Rules for Motorcyclists',
    ruleRange: 'Rules 83-88',
    summary:
      'Covers the rules specific to motorcyclists, including protective clothing, daytime headlight use, lane positioning, and filtering. Also covers CBT and licence requirements.',
    keyPoints: [
      'CBT (Compulsory Basic Training) must be completed before riding on public roads as a learner',
      'Wear appropriate protective clothing including a correctly fitted helmet (legally required)',
      'Use your headlight in daylight to make yourself more visible',
      'Be aware of your vulnerability — you are much less visible than larger vehicles',
      'Filtering through slow or stationary traffic is legal but must be done with great care',
    ],
    rules: [
      {
        ruleNumber: 83,
        title: 'CBT and licences',
        content:
          'Before riding on public roads as a learner, you must complete Compulsory Basic Training (CBT). A CBT certificate is valid for 2 years. You must also have a provisional licence for the appropriate category. Learner riders must display L-plates and cannot carry pillion passengers or use motorways (unless the motorcycle is controlled by an ADI).',
      },
      {
        ruleNumber: 84,
        title: 'Protective clothing',
        content:
          'You must wear a safety helmet that meets British Standard BS 6658:1985 or an equivalent standard. You should also wear appropriate protective clothing: jacket, trousers, gloves, and boots. Bright or fluorescent clothing improves daytime visibility; reflective clothing helps at night.',
      },
      {
        ruleNumber: 85,
        title: 'Daytime headlights',
        content:
          'Make yourself as visible as possible by using your headlight in daylight, as well as at night and in poor visibility. Position yourself where you can be seen by other road users. Be aware that some drivers may not see you even when you are visible.',
      },
      {
        ruleNumber: 86,
        title: 'Manoeuvring',
        content:
          'Filtering through slow-moving or stationary traffic is legal, provided it is done with care and at a safe speed. Be aware of vehicles pulling out, pedestrians stepping between vehicles, and doors opening. Avoid riding in the blind spots of large vehicles.',
      },
      {
        ruleNumber: 88,
        title: 'Motorways',
        content:
          'Motorcycle learners are not permitted on motorways unless accompanying an ADI on a dual-controlled motorcycle. Full licence holders may use motorways. Be aware of crosswinds, particularly when passing bridges or gaps in barriers. Maintain extra following distances at motorway speeds.',
      },
    ],
  },
  {
    id: 'ch6',
    chapterNumber: 6,
    title: 'Rules for Drivers and Motorcyclists',
    ruleRange: 'Rules 89-102',
    summary:
      'Covers the legal requirements before driving, including vehicle condition, documentation, physical fitness, and the use of mobile phones and seat belts. The 2022 update strengthened the mobile phone rules.',
    keyPoints: [
      'You must ensure your vehicle is roadworthy and documents are in order before driving',
      'Never drive if over the legal alcohol limit or under the influence of drugs',
      'Using a hand-held mobile phone while driving is illegal — even at a red light with the engine running',
      'All occupants must wear seat belts; drivers are responsible for passengers under 14',
      'You must be able to read a number plate at 20 metres and your vision must meet minimum standards',
    ],
    rules: [
      {
        ruleNumber: 89,
        title: 'Vehicle condition',
        content:
          'Before driving, ensure your vehicle is roadworthy. Check: tyres (condition and pressure), lights, brakes, steering, horn, and all fluid levels. Ensure the vehicle has valid MOT and road tax. The windscreen must be clean and clear.',
      },
      {
        ruleNumber: 90,
        title: 'Fitness to drive',
        content:
          'You must be physically and mentally fit to drive. Do not drive if you are taking medication that may impair your driving — check with your doctor or pharmacist. You must notify the DVLA if you have a medical condition that affects your driving.',
      },
      {
        ruleNumber: 91,
        title: 'Alcohol',
        content:
          'Do not drink and drive. The legal limit in England, Wales, and Northern Ireland is 35 micrograms of alcohol per 100ml of breath (80mg per 100ml of blood). In Scotland the limit is lower: 22mcg per 100ml breath (50mg per 100ml blood). The safest advice is not to drink at all if you are driving.',
      },
      {
        ruleNumber: 93,
        title: 'Vision',
        content:
          'You must be able to read a new-style number plate at 20 metres (or an old-style plate at 20.5 metres) in good daylight. If you need glasses or contact lenses to drive, you must wear them. You must notify the DVLA if your eyesight deteriorates to the point where you cannot meet this standard.',
      },
      {
        ruleNumber: 97,
        title: 'Mobile phones',
        content:
          'It is illegal to use a hand-held mobile phone or similar device while driving or while supervising a learner driver, even when stationary with the engine running. This includes texting, using the internet, and making calls. Hands-free devices are permitted but can still be a significant distraction. The penalty is £200 and 6 penalty points.',
      },
      {
        ruleNumber: 99,
        title: 'Seat belts',
        content:
          'You must wear a seat belt if one is fitted, unless you have a medical exemption certificate. Drivers are responsible for ensuring all passengers under 14 years wear a seat belt or use an appropriate child restraint. Adults (14 and over) are responsible for their own seat belt compliance.',
      },
      {
        ruleNumber: 100,
        title: 'Children in vehicles',
        content:
          'Children under 12 years or under 135cm must use an appropriate child car seat. Children under 3 must travel in a car seat at all times. A child should never be placed in a rear-facing seat in front of an active airbag. An adult seat belt alone is not appropriate for a young child.',
      },
      {
        ruleNumber: 101,
        title: 'Restricted views',
        content:
          'You must have a full view of the road ahead and use all mirrors effectively. Your windscreen must be clean and clear of obstructions. Sat-nav devices must not obstruct your view. Ensure any load on a roof rack does not restrict your mirror view.',
      },
    ],
  },
  {
    id: 'ch7',
    chapterNumber: 7,
    title: 'General Rules, Techniques and Advice',
    ruleRange: 'Rules 103-158',
    summary:
      'The most comprehensive chapter, covering signalling, speed limits, stopping distances, lighting, level crossings, and the Mirror-Signal-Manoeuvre routine. Essential reading for understanding the theory test.',
    keyPoints: [
      'Always use the Mirror-Signal-Manoeuvre (MSM) routine before any change of speed or direction',
      'Use signals to inform other road users — never use them to mislead',
      'Speed limits are a maximum, not a target — adjust for conditions',
      'The two-second rule: in good conditions keep at least a two-second gap from the vehicle in front (double in wet conditions)',
      'Rear fog lights must be used when visibility drops below 100 metres',
    ],
    rules: [
      {
        ruleNumber: 103,
        title: 'Mirror-Signal-Manoeuvre (MSM)',
        content:
          'Before any manoeuvre: use your mirrors to assess the traffic behind, give a signal if it will benefit other road users, then carry out the manoeuvre. The full routine is: Mirror, Signal, Position, Speed, Look (MSPSL) for more complex manoeuvres such as turning.',
      },
      {
        ruleNumber: 105,
        title: 'Signals',
        content:
          'Signals inform and warn other road users of your intended actions. Give signals clearly and in good time. Only use signals where they will be seen and understood. Never give misleading signals. Signal before pulling away, changing lane, turning, overtaking, or slowing down.',
      },
      {
        ruleNumber: 109,
        title: 'Hazard warning lights',
        content:
          'Use hazard warning lights only to warn other road users that you are temporarily obstructing traffic, when your vehicle is broken down, or to warn of a hazard ahead on a motorway or unrestricted dual carriageway. Do not use them as a reason to park illegally or to thank drivers.',
      },
      {
        ruleNumber: 110,
        title: 'Horn',
        content:
          'Use the horn only to warn other road users of your presence. Never use it to rebuke another driver. You must not use it: while stationary (unless a moving vehicle poses a danger), between 11.30pm and 7am in a built-up area.',
      },
      {
        ruleNumber: 113,
        title: 'Speed limits',
        content:
          'Speed limits are the maximum permitted speed, not a target. You must not exceed the posted limit. In built-up areas, the default limit is 30mph unless signs indicate otherwise. The national speed limit (60mph on single carriageways, 70mph on dual carriageways and motorways) applies where no lower limit is posted. Variable speed limits on smart motorways are mandatory when displayed.',
      },
      {
        ruleNumber: 117,
        title: 'Stopping distances',
        content:
          'At 30mph: thinking distance 9m, braking distance 14m, total 23m. At 60mph: thinking distance 18m, braking distance 55m, total 73m. At 70mph: thinking distance 21m, braking distance 75m, total 96m. In wet conditions, stopping distances at least double. In snow or ice, they can multiply by 10 or more.',
      },
      {
        ruleNumber: 119,
        title: 'The two-second rule',
        content:
          'In good conditions, keep at least a two-second gap between your vehicle and the vehicle ahead. Use a fixed reference point — when the vehicle ahead passes it, count "only a fool breaks the two-second rule". If you pass the point before finishing, drop back. In wet conditions, allow at least four seconds.',
      },
      {
        ruleNumber: 126,
        title: 'Overtaking',
        content:
          'Before overtaking, check it is safe and legal. Consider: is there enough clear road? Can you complete the overtake without forcing the vehicle you are overtaking or oncoming traffic to slow? Never overtake on a hill or bend. Never overtake where there are solid white centre lines. Allow more space for motorcycles and cyclists.',
      },
      {
        ruleNumber: 129,
        title: 'Moving into traffic',
        content:
          'Never overtake where it would force the vehicle in front to slow, where you would have to cross a solid white line, or where the road narrows. Do not overtake at or approaching a pedestrian crossing, at a level crossing, or at a junction. Give motorcycles and cyclists at least as much space as a car when overtaking.',
      },
      {
        ruleNumber: 134,
        title: 'Level crossings — automatic',
        content:
          'When red lights show and the alarm sounds, stop before the white line and never drive onto a crossing until there is room to clear it completely. Do not zig-zag around the barriers. If your vehicle stalls on a crossing, get all occupants out immediately, clear of the barrier, and phone the signal operator using the crossing telephone.',
      },
      {
        ruleNumber: 144,
        title: 'Lighting — dipped headlights',
        content:
          'Use dipped headlights at night in street-lit areas. Switch to full beam when there is no oncoming traffic. Return to dipped beams when you see oncoming lights. Do not use full beam if it would dazzle a driver in front of you. Use dipped headlights in poor daytime visibility.',
      },
      {
        ruleNumber: 148,
        title: 'Distractions in vehicles',
        content:
          'Drivers must not allow distracting activities in the vehicle. Do not read maps, use a hand-held phone, take photos, or engage in any other activity that takes your attention away from driving. Rule 148: loud music, animated conversation, and even legal hands-free phone use can all distract significantly.',
      },
      {
        ruleNumber: 149,
        title: 'Sleepiness',
        content:
          'Never drive when you are tired. The only safe treatment for tiredness is sleep. Stimulants such as caffeine provide only short-term relief. If you feel sleepy, stop in a safe place (not the hard shoulder of a motorway) and take a 15-20 minute rest. Plan for breaks at least every two hours on long journeys.',
      },
    ],
  },
  {
    id: 'ch8',
    chapterNumber: 8,
    title: 'Using the Road',
    ruleRange: 'Rules 159-203',
    summary:
      'Covers the detailed rules for using lanes, manoeuvring, turning, overtaking at junctions, roundabouts, and all types of pedestrian crossings. Also covers reversing and loading.',
    keyPoints: [
      'Keep left unless overtaking — do not stay in the middle or right lane when the left is free',
      'At a roundabout, traffic already on the roundabout has priority over entering traffic',
      'Give way to pedestrians already crossing when you are turning into or out of a road',
      'Only reverse where it is safe and necessary — never reverse from a minor road onto a main road',
      'Box junctions (yellow squares): only enter if your exit is clear (exception: turning right)',
    ],
    rules: [
      {
        ruleNumber: 159,
        title: 'Moving off',
        content:
          'Before moving off: use all mirrors, check blind spots, signal if necessary. Move off only when it is safe. In traffic, move off in first gear. On a hill, use the handbrake to avoid rolling back. Keep a lookout for pedestrians and cyclists alongside or in front of your vehicle.',
      },
      {
        ruleNumber: 160,
        title: 'While driving',
        content:
          'Keep a safe following distance. Keep to the left unless overtaking, turning right, or signs/markings indicate otherwise. Hold the steering wheel properly. Never drive so fast that you cannot stop within the distance you can see to be clear.',
      },
      {
        ruleNumber: 163,
        title: 'Overtaking cyclists',
        content:
          'When overtaking cyclists or motorcyclists, give them at least as much space as you would a car. Pass at a safe, comfortable distance: the Highway Code recommends at least 1.5 metres at speeds up to 30mph, with more space at higher speeds. Do not overtake and then immediately turn left.',
      },
      {
        ruleNumber: 170,
        title: 'Junctions — turning right',
        content:
          'When turning right: signal in good time, take up the correct road position (near the centre of the road or the right-turn lane), wait for a safe gap in oncoming traffic, check mirrors and blind spots, and complete the turn. Give way to oncoming vehicles and to cyclists and pedestrians crossing.',
      },
      {
        ruleNumber: 172,
        title: 'Box junctions',
        content:
          'Yellow box junctions (criss-cross yellow lines): you must not enter the box if your exit is not clear. You may enter to wait when turning right if oncoming traffic or pedestrians prevent you from completing the turn.',
      },
      {
        ruleNumber: 177,
        title: 'Pedestrians crossing when turning',
        content:
          'When turning into or out of a side road: give way to pedestrians already crossing the road you are turning into or out of. You must give way to pedestrians crossing at a junction.',
      },
      {
        ruleNumber: 182,
        title: 'Roundabouts — priority',
        content:
          'When approaching a roundabout, give way to traffic already on the roundabout (coming from your right) unless signs or road markings indicate otherwise. Give way to cyclists and horse riders on the roundabout. Watch out for motorcyclists and cyclists who may be difficult to see.',
      },
      {
        ruleNumber: 186,
        title: 'Roundabouts — lanes and signalling',
        content:
          'On a roundabout: for the first exit (left), approach in the left lane and signal left from the start. For straight ahead, approach in the left lane (or right if left is congested) and signal left after passing the exit before the one you want. For the right or going more than halfway round, approach in the right lane and signal right. Signal left before your exit.',
      },
      {
        ruleNumber: 195,
        title: 'Pedestrians crossing at junctions',
        content:
          'Drivers, motorcyclists, and cyclists must give way to pedestrians who are crossing or waiting to cross at a junction. This is a 2022 update to the Highway Code that elevated pedestrian priority at junctions. Be prepared to stop.',
      },
      {
        ruleNumber: 200,
        title: 'Reversing',
        content:
          'Never reverse farther than is necessary. Use your mirrors and look around for other road users before and during the manoeuvre. It is safer to get out and check if you cannot see clearly. Only use a driveway or side road when reversing — never reverse from a side road onto a main road.',
      },
    ],
  },
  {
    id: 'ch9',
    chapterNumber: 9,
    title: 'Road Users Requiring Extra Care',
    ruleRange: 'Rules 204-225',
    summary:
      'Covers how drivers should behave around vulnerable road users, including pedestrians, cyclists, motorcyclists, larger vehicles, and emergency vehicles. Updated in 2022 to give cyclists and pedestrians greater priority.',
    keyPoints: [
      'Pedestrians have priority — watch out for them at crossings and when turning',
      'Give cyclists at least 1.5m clearance when overtaking at 30mph or below',
      'Motorcycles are less visible — look twice at junctions',
      'Large vehicles may swing wide on turns — do not pass on the inside',
      'Always give way to emergency vehicles with blue lights and sirens',
    ],
    rules: [
      {
        ruleNumber: 204,
        title: 'Pedestrians',
        content:
          'Watch for pedestrians at all times, especially at crossings and near schools. When turning, give way to pedestrians already crossing. Be ready to slow or stop at zebra crossings when pedestrians are waiting. Give extra care to children, elderly people, and people with disabilities.',
      },
      {
        ruleNumber: 211,
        title: 'Motorcyclists and cyclists',
        content:
          'At junctions, always look twice for motorcyclists and cyclists — their smaller profile makes them easy to miss. Give them plenty of room. When overtaking, give at least as much space as you would a car. Be aware that cyclists may ride in the centre of a narrow lane.',
      },
      {
        ruleNumber: 212,
        title: 'Cyclists at junctions',
        content:
          'Beware of cyclists approaching on your left when turning left. Cyclists may be going faster than you expect. Do not cut across their path. Give way to any cyclist who may be passing or about to pass as you turn.',
      },
      {
        ruleNumber: 213,
        title: 'Large vehicles',
        content:
          'Large vehicles may swing out to the right before turning left — do not try to pass on the left. They have large blind spots: if you cannot see the driver\'s mirrors, they cannot see you. Give them extra space when they are manoeuvring.',
      },
      {
        ruleNumber: 219,
        title: 'Emergency vehicles',
        content:
          'When you see or hear an emergency vehicle approaching with blue lights and siren, pull over to the left and stop if safe to do so. Do not mount kerbs, run red lights, or pull into bus stops. On a motorway, move to the left or side lane. Do not impede an emergency vehicle.',
      },
      {
        ruleNumber: 220,
        title: 'Buses and coaches',
        content:
          'Give way to buses pulling away from bus stops where it is safe to do so. Watch for passengers getting on or off, particularly from the front of buses where they may step into the road. Take extra care near school buses.',
      },
      {
        ruleNumber: 223,
        title: 'Buses at bus stops',
        content:
          'You should give priority to buses, coaches, and trams when you can do so safely. If a bus is signalling to pull out from a bus stop, allow it to do so if it is safe. This is a courtesy rather than an absolute legal requirement, but refusing when safe to yield is inconsiderate and can be dangerous.',
      },
    ],
  },
  {
    id: 'ch10',
    chapterNumber: 10,
    title: 'Driving in Adverse Conditions',
    ruleRange: 'Rules 226-237',
    summary:
      'Covers driving in fog, ice, snow, heavy rain, and other poor conditions. Sets out when to use fog lights and how to adjust speed and technique for adverse conditions.',
    keyPoints: [
      'Use rear fog lights when visibility drops below 100 metres — switch them off when conditions improve',
      'In fog, reduce speed and increase following distance — you must be able to stop in the distance you can see',
      'In snow and ice, stopping distances can be ten times those in dry conditions',
      'In heavy rain, stopping distances double — increase your following distance',
      'If flooding is possible, drive slowly and test brakes after passing through water',
    ],
    rules: [
      {
        ruleNumber: 226,
        title: 'Adverse weather — general',
        content:
          'Adjust your speed and following distance for the conditions. Poor weather can significantly increase stopping distances and reduce visibility. Never assume that your vehicle can handle all conditions — even modern vehicles with good tyres have reduced grip on wet, icy, or snowy surfaces.',
      },
      {
        ruleNumber: 228,
        title: 'Fog',
        content:
          'In fog, use dipped headlights. Use rear fog lights when visibility drops below approximately 100 metres. Do not use front fog lights unless visibility is seriously reduced. Switch fog lights off when visibility improves. Reduce speed and increase your following distance to at least double the normal gap. You must be able to stop within the distance you can see ahead.',
      },
      {
        ruleNumber: 229,
        title: 'Ice and snow',
        content:
          'In icy conditions, stopping distances can be ten times greater than in dry weather. Gentle acceleration, braking, and steering are essential. Brake gently with progressive pressure. Use the highest gear possible to reduce the risk of wheel spin. On a hill, consider whether it is safe to continue. Keep to gritted roads where possible.',
      },
      {
        ruleNumber: 230,
        title: 'Wind',
        content:
          'High winds affect all vehicles, particularly high-sided vehicles, caravans, and motorcycles. Crosswinds can cause sudden loss of control. Be extra cautious on exposed roads, bridges, and when overtaking high-sided vehicles. Sudden gusts can push a vehicle across lanes.',
      },
      {
        ruleNumber: 232,
        title: 'Wet roads',
        content:
          'In rain, stopping distances at least double. Reduce speed accordingly and increase your following distance. Your tyres need to displace water to maintain grip — worn tyres greatly increase aquaplaning risk at speed. If aquaplaning occurs, ease off the accelerator gently and do not brake sharply.',
      },
      {
        ruleNumber: 234,
        title: 'Flooding',
        content:
          'When approaching flooding, slow right down. Never drive into flooding if you cannot see the bottom, or if the water level is above the bottom of your doors. Drive through slowly in first gear at a steady engine speed. After driving through water, test your brakes as soon as possible by applying gentle pressure.',
      },
    ],
  },
  {
    id: 'ch11',
    chapterNumber: 11,
    title: 'Waiting and Parking',
    ruleRange: 'Rules 238-252',
    summary:
      'Sets out where you may and may not wait or park, including yellow line restrictions, clearways, disabled bays, and the rules around loading and unloading.',
    keyPoints: [
      'Double yellow lines: no waiting at any time',
      'Single yellow line: restricted waiting — check the signs for times',
      'Urban clearways: no stopping at all during the sign\'s restricted hours',
      'Never park on zigzag lines near a pedestrian crossing',
      'Always park on the left, facing the direction of traffic, and use the handbrake',
    ],
    rules: [
      {
        ruleNumber: 238,
        title: 'Parking — general',
        content:
          'When parking, pull up as close to the left as possible and as close to the kerb. Apply the handbrake and switch off the engine. If parking on a hill facing downhill, turn the wheels into the kerb and apply the handbrake. Facing uphill, turn wheels away from the kerb.',
      },
      {
        ruleNumber: 240,
        title: 'Where parking is prohibited',
        content:
          'You must not park: on a road marked with double yellow lines, a clearway, on an urban clearway during restricted hours, at a bus stop, on a cycle lane, opposite a traffic island, within 10 metres of a junction, on double white lines, or blocking a vehicle entrance.',
      },
      {
        ruleNumber: 241,
        title: 'Urban clearways',
        content:
          'On urban clearways, stopping for any reason during the restricted hours is not permitted except to board or alight passengers. Unlike ordinary clearways, you may stop to set down or pick up passengers, but must not leave the vehicle. Signs show the restricted hours.',
      },
      {
        ruleNumber: 243,
        title: 'Yellow lines',
        content:
          'Double yellow lines mean no waiting at any time. Single yellow lines mean waiting is restricted to the times shown on nearby signs. Always check the sign, as times vary. Loading and unloading restrictions are shown by kerb marks (yellow ticks on the kerb).',
      },
      {
        ruleNumber: 248,
        title: 'Parking at night',
        content:
          'When parking at night on a road with a speed limit greater than 30mph, you must leave your parking lights on. In a 30mph or lower limit, you do not need lights if the vehicle is close to the kerb and facing the direction of traffic. Never park with your back to oncoming traffic.',
      },
      {
        ruleNumber: 252,
        title: 'Pedestrian crossings and zigzag lines',
        content:
          'Never stop or park on zigzag lines on the approach to or exit from a pedestrian crossing. You must not stop within the zig-zag area — not even to pick up or set down passengers. This area must be kept clear so pedestrians and drivers can see each other.',
      },
    ],
  },
  {
    id: 'ch12',
    chapterNumber: 12,
    title: 'Motorways',
    ruleRange: 'Rules 253-273',
    summary:
      'Sets out the specific rules for joining, using, and leaving motorways, lane discipline, stopping, smart motorways, and what to do in an emergency. Includes the 2022 smart motorway safety updates.',
    keyPoints: [
      'Keep left unless overtaking — the right lane is for overtaking only',
      'Never reverse, cross the central reservation, or stop on the carriageway unless in an emergency',
      'Break down: pull left to the hard shoulder or ERA, exit left, stand behind the barrier',
      'A red X on an overhead gantry means the lane is closed — it is a criminal offence to drive in it',
      'Variable speed limits on smart motorways are mandatory when displayed on gantry signs',
    ],
    rules: [
      {
        ruleNumber: 253,
        title: 'Who may not use motorways',
        content:
          'The following are not permitted on motorways: learner drivers (except when accompanied by an ADI in a dual-controlled vehicle since June 2018), motorcycles under 50cc, agricultural vehicles, pedestrians, cyclists, powered wheelchairs and mobility scooters.',
      },
      {
        ruleNumber: 259,
        title: 'Joining the motorway',
        content:
          'When joining from a slip road, build up speed on the slip road to match the flow of traffic on the motorway. Give priority to traffic already on the motorway. Do not stop at the end of the slip road. Use the mirrors and blind spot checks before merging. Join in the left lane.',
      },
      {
        ruleNumber: 264,
        title: 'Lane discipline',
        content:
          'Keep to the left lane unless overtaking. After overtaking, return to the left lane when it is safe. Lane hogging (remaining in the middle lane when the left lane is clear) is a careless driving offence. Vehicles over 7.5 tonnes and vehicles towing trailers must not use the right-hand lane of a motorway with three or more lanes.',
      },
      {
        ruleNumber: 266,
        title: 'Speed on motorways',
        content:
          'The national speed limit for a car on a motorway is 70mph. The limit for buses and coaches is 60mph. Vehicles over 7.5 tonnes have a 60mph limit. Variable speed limits displayed on overhead gantries are mandatory. A red X means the lane is closed.',
      },
      {
        ruleNumber: 270,
        title: 'Breakdowns — what to do',
        content:
          'If you break down, try to reach the next junction or service area. If you cannot, pull left to the hard shoulder. Switch on hazard lights. Exit the vehicle from the left (nearside) door only. Do not place a warning triangle on a motorway. Stand behind the barrier and call for recovery using a motorway emergency phone or mobile. Do not attempt repairs near the carriageway.',
      },
      {
        ruleNumber: 272,
        title: 'Smart motorways — Emergency Refuge Areas',
        content:
          'On smart motorways where the hard shoulder operates as a running lane, Emergency Refuge Areas (ERAs) are provided approximately every 1.5 to 2.5 miles. In an emergency, reach an ERA if possible. ERAs have orange SOS phones. If you cannot reach one, pull as far left as possible, switch on hazard lights, and call 999.',
      },
      {
        ruleNumber: 273,
        title: 'Leaving the motorway',
        content:
          'Use countdown markers (300, 200, 100 yards) to plan your exit. Get into the left lane in good time. Reduce speed on the slip road, not the motorway. Be aware that your speed perception may be affected after high-speed motorway driving — check the speedometer as you leave.',
      },
    ],
  },
  {
    id: 'ch13',
    chapterNumber: 13,
    title: 'Breakdowns and Incidents',
    ruleRange: 'Rules 274-287',
    summary:
      'Covers what to do if your vehicle breaks down, or if you come across a road traffic incident. Includes first aid guidance, fire safety, and when to call the emergency services.',
    keyPoints: [
      'In a breakdown, get off the carriageway, use hazard lights, and call for help from a safe place',
      'If you come across an incident: warn other traffic, call 999, and give first aid if trained',
      'DR ABC: Danger, Response, Airway, Breathing, Circulation',
      'Do not move a seriously injured person unless there is immediate danger',
      'Never remove a motorcyclist\'s helmet unless the airway is blocked',
    ],
    rules: [
      {
        ruleNumber: 274,
        title: 'Breakdown — general',
        content:
          'If your vehicle breaks down, first try to reach a place of safety away from the carriageway. If you cannot: signal, move to the left, and stop as safely as possible. Switch on hazard warning lights. On a motorway, leave the vehicle from the left-hand door. Do not remain inside the vehicle on the carriageway.',
      },
      {
        ruleNumber: 277,
        title: 'Warning triangles',
        content:
          'Warning triangles should be placed approximately 45 metres behind the vehicle on the same side of the road. However, on a motorway, do NOT use a warning triangle — walking on the carriageway to place one is extremely dangerous. Use hazard lights only.',
      },
      {
        ruleNumber: 280,
        title: 'At an incident — priorities',
        content:
          'If you come across an incident: warn other traffic (use hazard lights, ask others to warn approaching vehicles). Call 999 giving your location, the nature of the incident, and whether anyone is injured. Give first aid if you are trained. Do not move injured people unless they are in immediate danger.',
      },
      {
        ruleNumber: 281,
        title: 'First aid — DR ABC',
        content:
          'Danger: check for hazards before approaching. Response: speak to the casualty and tap their shoulders. Airway: tilt the head back and lift the chin. Breathing: look, listen, and feel for breathing for up to 10 seconds. Circulation: if not breathing normally, call 999 and begin CPR — 30 compressions, 2 rescue breaths (or compressions only if untrained).',
      },
      {
        ruleNumber: 283,
        title: 'Reporting accidents',
        content:
          'You must stop after a collision if: injury is caused to another person, damage is caused to another vehicle or property, an animal (horse, cattle, ass, mule, sheep, pig, goat, or dog) is injured. If you cannot give your details at the scene, report the incident to the police within 24 hours.',
      },
      {
        ruleNumber: 284,
        title: 'Vehicle fires',
        content:
          'If a vehicle catches fire: get all occupants away from the vehicle immediately and at least 100 metres away. Call 999. Never attempt to fight a vehicle fire without specialist equipment. The fuel tank may explode without warning.',
      },
      {
        ruleNumber: 286,
        title: 'Obstructions on the carriageway',
        content:
          'If your vehicle is causing an obstruction or you are involved in an incident that blocks the road: move the vehicle if it is safe and legal to do so. Switch on hazard lights. Call 999 if the obstruction creates a serious danger or cannot be moved.',
      },
    ],
  },
  {
    id: 'ch14',
    chapterNumber: 14,
    title: 'Road Works, Level Crossings and Tramways',
    ruleRange: 'Rules 288-307',
    summary:
      'Covers how to behave at roadworks, how to approach and use level crossings safely, and the rules for driving near or across tramways.',
    keyPoints: [
      'Obey speed limits in road works — they are mandatory when shown on overhead signs',
      'At level crossings, never start to cross if red lights flash or the alarm sounds',
      'If stuck on a level crossing, get everyone clear and call the signal operator immediately',
      'Never stop on tram rails or block a tram route',
      'Trams cannot steer around obstacles — never obstruct their path',
    ],
    rules: [
      {
        ruleNumber: 288,
        title: 'Road works',
        content:
          'Obey any speed limits in force at road works. These are mandatory when displayed on overhead signs. Slow down on the approach to road works. Merge in turn when lanes are reduced. Obey the instructions of any traffic officers. Be aware of workers near the road.',
      },
      {
        ruleNumber: 290,
        title: 'Level crossings — automatic',
        content:
          'When red lights flash and the alarm sounds, stop before the white stop line. Never drive onto a level crossing unless there is room to clear it completely on the other side. If barriers descend while you are on the crossing, never try to zig-zag around them.',
      },
      {
        ruleNumber: 291,
        title: 'Level crossings — stalled vehicle',
        content:
          'If your vehicle stalls or breaks down on a level crossing, get all occupants out immediately and clear of the crossing. Use the crossing\'s telephone (if available) to alert the signal operator. If no phone, call 999. Move the vehicle only if time permits and it is safe to do so.',
      },
      {
        ruleNumber: 293,
        title: 'Open crossings',
        content:
          'At crossings without barriers or lights, look both ways along the railway before crossing and make sure it is safe. Treat a train as you would any other vehicle — it cannot stop quickly. Give way to any approaching train.',
      },
      {
        ruleNumber: 300,
        title: 'Tramways',
        content:
          'Look out for trams. They cannot steer around obstacles and cannot stop quickly. Never stop on tram rails or in a tram lane. Give way to trams. Watch for pedestrians and cyclists near tram stops. Be aware that trams may approach from either direction.',
      },
      {
        ruleNumber: 303,
        title: 'Tram lanes and stops',
        content:
          'Do not drive in a tram lane unless directed by signs. At tram stops, pedestrians may step into the road from the stop — watch for them. You may overtake a tram stopped at a stop provided no passengers are boarding or alighting on the road. Check carefully before doing so.',
      },
      {
        ruleNumber: 306,
        title: 'Crossing tram rails',
        content:
          'Cross tram rails at as near a right angle as possible to reduce the risk of wheels becoming trapped. Tram rails are slippery when wet, especially for cyclists and motorcyclists. Avoid driving over rails in a way that could cause instability or loss of traction.',
      },
    ],
  },
  {
    id: 'ch15',
    chapterNumber: 15,
    title: 'Light Signals Controlling Traffic',
    ruleRange: 'No rule numbers',
    summary:
      'Explains the sequence and meaning of traffic light signals, including signals at junctions, pedestrian crossings, and filter arrows. The Green Arrow filter signal is also covered.',
    keyPoints: [
      'Red: stop and wait behind the stop line',
      'Red and amber together: prepare to move but do not go until green',
      'Green: proceed if the way is clear',
      'Amber alone: stop if you can do so safely — do not try to "beat" amber',
      'Green filter arrow: proceed in the direction of the arrow — other lights may be red',
    ],
    rules: [
      {
        ruleNumber: 0,
        title: 'Traffic light sequence',
        content:
          'UK traffic lights follow the sequence: Red → Red and Amber (stop, prepare to move) → Green (proceed if safe) → Amber (stop if able) → Red. Green means you may proceed if the junction is clear and it is safe to do so. Amber means stop unless you are so close to the stop line that stopping would be dangerous.',
      },
      {
        ruleNumber: 0,
        title: 'Green filter arrows',
        content:
          'A green filter arrow may appear in addition to a red light, indicating that traffic may proceed in the direction of the arrow even though the main signal is red. Other traffic may have a green light, so take care. The filter arrow means you may go in that direction only.',
      },
      {
        ruleNumber: 0,
        title: 'Flashing amber at pelican crossings',
        content:
          'At pelican crossings, a flashing amber light follows the red phase. During a flashing amber, drivers must give way to any pedestrian still on the crossing. If the crossing is clear, drivers may proceed.',
      },
      {
        ruleNumber: 0,
        title: 'Lane-control signals (overhead gantries)',
        content:
          'On motorways and some roads, overhead gantry signs control lane use. A red X means the lane is closed — you must not drive in it. A downward white arrow means the lane is open. A speed limit in a red circle is mandatory. An amber warning triangle means there is a hazard ahead.',
      },
    ],
  },
  {
    id: 'ch16',
    chapterNumber: 16,
    title: 'Signals by Authorised Persons',
    ruleRange: 'No rule numbers',
    summary:
      'Describes the hand signals given by police officers, traffic wardens, and school crossing patrols to control traffic, and explains what drivers must do in response.',
    keyPoints: [
      'A police officer facing you with arm extended means stop',
      'A police officer beckoning you from the side means come forward',
      'A school crossing patrol (lollipop person) stopping you must be obeyed',
      'You must comply with signals from authorised persons at all times',
      'Authorised persons include police officers, traffic officers, and DVSA examiners',
    ],
    rules: [
      {
        ruleNumber: 0,
        title: 'Police signals — stop',
        content:
          'A police officer or traffic officer facing traffic with one arm raised means stop. You must stop and wait. A police officer standing sideways with arm extended to the side means traffic on that side must stop. You must obey these signals.',
      },
      {
        ruleNumber: 0,
        title: 'Police signals — proceed',
        content:
          'A police officer beckoning you with one arm means come forward. If the officer is waving their arm in a circular motion, it means come from the side. Always approach slowly and follow the officer\'s instructions carefully.',
      },
      {
        ruleNumber: 0,
        title: 'School crossing patrols',
        content:
          'When a school crossing patrol (lollipop person) holds out their stop sign and steps into the road, you must stop. You may not proceed until the patrol has returned to the pavement and it is safe to do so. Failing to stop is a criminal offence.',
      },
    ],
  },
  {
    id: 'ch17',
    chapterNumber: 17,
    title: 'Traffic Signs',
    ruleRange: 'No rule numbers',
    summary:
      'Explains the meaning and categories of traffic signs: warning signs (triangles), regulatory signs (circles), and information signs (rectangles). Also covers temporary signs and variable message signs.',
    keyPoints: [
      'Triangular signs with red border: warnings (e.g. crossroads, slippery road, children)',
      'Circular signs with red border: prohibitions (e.g. speed limits, no entry)',
      'Circular signs with blue background: mandatory instructions (e.g. roundabout, keep left)',
      'Rectangular signs: information (e.g. directions, distances)',
      'Brown signs indicate tourist attractions or places of interest',
    ],
    rules: [
      {
        ruleNumber: 0,
        title: 'Warning signs (triangles)',
        content:
          'Warning signs are usually red-bordered triangles pointing upward. They warn of hazards ahead such as crossroads, roundabouts, bends, schools, pedestrians, cattle, and roadworks. A triangular sign gives you warning of a hazard — slow down and be prepared.',
      },
      {
        ruleNumber: 0,
        title: 'Regulatory signs (circles)',
        content:
          'Round signs with red borders are prohibitory or restrictive — they tell you what you must not do (e.g. no entry, no overtaking, speed limits). Round blue signs are mandatory — they tell you what you must do (e.g. keep left, use roundabout, minimum speed).',
      },
      {
        ruleNumber: 0,
        title: 'Information signs (rectangles)',
        content:
          'Rectangular signs give information and direction. Blue rectangles are used on motorways. Green rectangles are used on primary routes. White rectangles are used on local roads. Brown rectangles direct to tourist destinations. Temporary signs are on yellow backgrounds.',
      },
      {
        ruleNumber: 0,
        title: 'Temporary signs',
        content:
          'Temporary traffic signs in road works are displayed on yellow backgrounds. They override permanent signs. Temporary speed limits shown on overhead signs are mandatory. Obey them even if the road appears clear.',
      },
    ],
  },
  {
    id: 'ch18',
    chapterNumber: 18,
    title: 'Road Markings',
    ruleRange: 'No rule numbers',
    summary:
      'Explains white and yellow road markings including centre lines, lane dividers, give way lines, stop lines, hatching, and parking restriction marks on kerbs.',
    keyPoints: [
      'Broken white centre line: you may cross if safe to do so',
      'Solid white line (on your side): do not cross or straddle — stop where required',
      'Double white lines: complex rules — generally do not cross if the nearest line to you is solid',
      'Yellow box markings: do not enter unless your exit is clear (except when turning right)',
      'Yellow kerb marks (ticks): loading/unloading restrictions — check nearby signs for times',
    ],
    rules: [
      {
        ruleNumber: 0,
        title: 'Centre lines',
        content:
          'A short broken white line down the centre of the road (lane divider) may be crossed to overtake if it is safe to do so. A longer broken line (hazard warning line) warns of a hazard — do not cross unless you can see clearly and it is safe. A continuous white line means do not cross.',
      },
      {
        ruleNumber: 0,
        title: 'Double white lines',
        content:
          'Where double white lines are painted on the road: if the nearest line to you is unbroken, do not cross or straddle the lines. If the nearest line is broken, you may cross to overtake if it is safe and you can complete the manoeuvre before reaching a solid line.',
      },
      {
        ruleNumber: 0,
        title: 'Give way and stop lines',
        content:
          'A broken line across a road (give way marking) means give way to traffic on the major road. A solid white line (stop line) means stop and give way. You must stop completely at a stop line whether or not there is a sign. The STOP sign always has a solid white line.',
      },
      {
        ruleNumber: 0,
        title: 'Hatched areas',
        content:
          'White diagonal stripes or chevrons on the road surface (ghost islands) are used to divide traffic streams or protect turning vehicles. If bordered by a broken line, you should not enter the area unless necessary and it is safe. If bordered by a solid line, do not enter under any circumstances.',
      },
      {
        ruleNumber: 0,
        title: 'Yellow kerb marks',
        content:
          'Yellow ticks or lines on the kerb indicate loading and unloading restrictions. A double yellow kerb tick means no loading or unloading at any time. A single yellow kerb tick means loading is restricted during certain times. Check the signs on the road for the restriction hours.',
      },
    ],
  },
  {
    id: 'ch19',
    chapterNumber: 19,
    title: 'Vehicle Markings',
    ruleRange: 'No rule numbers',
    summary:
      'Covers the markings displayed on certain vehicles, including large goods vehicles, school buses, and vehicles carrying hazardous loads. Explains what these markings mean for other road users.',
    keyPoints: [
      'Yellow and black "LONG VEHICLE" boards warn other road users of exceptionally long loads',
      'Orange hazmat panels on tankers carry UN hazard numbers — inform emergency services in an incident',
      'Green and yellow reflective markings on rear of lorries improve night visibility',
      'School buses display yellow markings and signs when carrying children',
      'Abnormal loads must have escort vehicles with amber flashing lights',
    ],
    rules: [
      {
        ruleNumber: 0,
        title: 'Large goods vehicles',
        content:
          'Long vehicles must display "LONG VEHICLE" marker boards at the rear when they exceed 18.65 metres in total length. Reflective rear markings (yellow and red stripes) are required on HGVs and trailers to improve visibility at night.',
      },
      {
        ruleNumber: 0,
        title: 'Hazardous load markings',
        content:
          'Vehicles carrying hazardous materials display orange plates showing UN hazard identification numbers. The top number identifies the hazard type; the bottom is the UN substance code. If you witness an incident involving a vehicle with these markings, call 999 immediately and give them the numbers.',
      },
      {
        ruleNumber: 0,
        title: 'Abnormal loads',
        content:
          'Abnormal loads that are wider, longer, or heavier than permitted maximums must be notified to the police and highways authority, and may require a police escort. They travel with amber-flashing escort vehicles to warn other road users. Exceptionally wide loads are often moved at night.',
      },
      {
        ruleNumber: 0,
        title: 'School bus markings',
        content:
          'Vehicles transporting school children often display yellow flashing lights and a "SCHOOL BUS" sign when children are boarding or alighting. Take extra care around school buses, particularly at stops. Be alert for children running into the road near school buses.',
      },
    ],
  },
  {
    id: 'annexes',
    chapterNumber: 20,
    title: 'Annexes',
    ruleRange: 'Annexes 1-8',
    summary:
      'Contains supplementary information including penalties for motoring offences, vehicle documentation requirements, first aid guidance, stopping distances, and the safety code for new drivers.',
    keyPoints: [
      'Fixed penalty: 3 points and £100 for most speeding offences; 6 points for mobile phone use',
      'Drink-driving: minimum 12-month ban, unlimited fine, up to 6 months imprisonment',
      '12 or more penalty points within 3 years results in automatic disqualification',
      'First aid: DR ABC — Danger, Response, Airway, Breathing, Circulation',
      'New drivers: 6+ points within 2 years of passing means licence is revoked',
    ],
    rules: [
      {
        ruleNumber: 0,
        title: 'Annexe 1 — Fixed penalty offences',
        content:
          'Fixed penalty notices can be issued for: speeding (£100, 3 points), using a hand-held mobile phone (£200, 6 points), careless driving (£100, 3 points), not wearing a seat belt (£100), running a red light (£100, 3 points). For some offences, a speed awareness or other educational course may be offered as an alternative.',
      },
      {
        ruleNumber: 0,
        title: 'Annexe 2 — Penalties',
        content:
          'Drink-driving: minimum 12-month ban, unlimited fine, up to 6 months\' imprisonment. Dangerous driving: up to 2 years\' imprisonment. Causing death by dangerous driving: up to 14 years\' imprisonment. Accumulating 12+ penalty points within 3 years results in a minimum 6-month disqualification.',
      },
      {
        ruleNumber: 0,
        title: 'Annexe 3 — Vehicle maintenance',
        content:
          'All vehicles must be kept in a roadworthy condition. Key checks: tyres (minimum 1.6mm tread across the central three-quarters over the full circumference), brakes, lights, steering, mirrors, wipers, and horn. Legally required to have a valid MOT (once 3 years old), insurance, and road tax.',
      },
      {
        ruleNumber: 0,
        title: 'Annexe 4 — First aid',
        content:
          'DR ABC: Danger (check for hazards), Response (check consciousness by tapping shoulders and asking), Airway (tilt head back, lift chin), Breathing (look, listen, feel for up to 10 seconds), Circulation (if not breathing, call 999 and start CPR: 30 compressions at 100-120/min, 2 rescue breaths or compressions only).',
      },
      {
        ruleNumber: 0,
        title: 'Annexe 7 — Stopping distances',
        content:
          'At 20mph: 12m (3 car lengths). At 30mph: 23m (6 car lengths). At 40mph: 36m (9 car lengths). At 50mph: 53m (13 car lengths). At 60mph: 73m (18 car lengths). At 70mph: 96m (24 car lengths). In wet conditions, double these distances. In snow or ice, up to ten times the dry distance.',
      },
      {
        ruleNumber: 0,
        title: 'Annexe 8 — Safety code for new drivers',
        content:
          'New drivers (within first 2 years of passing their test) face licence revocation if they accumulate 6 or more penalty points. Key advice: do not drink and drive; do not speed; wear a seat belt; carry only as many passengers as the vehicle is designed for; be aware of fatigue, especially late at night; do not use a mobile phone.',
      },
    ],
  },
];

export function getChapterByNumber(num: number): HCChapter | undefined {
  return highwayCodeChapters.find((c) => c.chapterNumber === num);
}

export function getRuleByNumber(ruleNumber: number): { chapter: HCChapter; rule: HCRule } | undefined {
  for (const chapter of highwayCodeChapters) {
    const rule = chapter.rules.find((r) => r.ruleNumber === ruleNumber);
    if (rule) return { chapter, rule };
  }
  return undefined;
}

export function searchHighwayCode(query: string): { chapter: HCChapter; rule?: HCRule }[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: { chapter: HCChapter; rule?: HCRule }[] = [];

  for (const chapter of highwayCodeChapters) {
    if (
      chapter.title.toLowerCase().includes(q) ||
      chapter.summary.toLowerCase().includes(q) ||
      chapter.keyPoints.some((kp) => kp.toLowerCase().includes(q))
    ) {
      results.push({ chapter });
    }
    for (const rule of chapter.rules) {
      if (
        rule.title.toLowerCase().includes(q) ||
        rule.content.toLowerCase().includes(q)
      ) {
        results.push({ chapter, rule });
      }
    }
  }
  return results;
}
