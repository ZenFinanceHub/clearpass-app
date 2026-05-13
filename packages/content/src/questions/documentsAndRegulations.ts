// PLACEHOLDER - replace with licensed DVSA content
import { Question, TopicCategory } from '@clearpass/core';

export const documentsAndRegulationsQuestions: Question[] = [
  {
    id: 'DOC_001',
    questionText: 'How long is a full UK driving licence valid for before it must be renewed?',
    options: [
      '5 years',
      '10 years',
      '20 years',
      'It never expires',
    ],
    correctIndex: 1,
    explanation:
      'A full UK photocard driving licence is valid for 10 years, after which the photo must be updated. The entitlement to drive remains, but the photocard itself must be renewed every 10 years to keep the photo current.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 1,
  },
  {
    id: 'DOC_002',
    questionText: 'What is the minimum age to apply for a provisional driving licence for a car?',
    options: [
      '15',
      '16',
      '17',
      '18',
    ],
    correctIndex: 1,
    explanation:
      'You can apply for a provisional driving licence for a car from age 16 and can start driving at 17. For some vehicle categories (mopeds, agricultural tractors) the minimum age to drive may differ.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 1,
  },
  {
    id: 'DOC_003',
    questionText: 'You are involved in a road traffic collision and do not have your insurance certificate with you. Within how many days must you produce it to a police station?',
    options: [
      '5 days',
      '7 days',
      '10 days',
      '14 days',
    ],
    correctIndex: 1,
    explanation:
      'If asked by a police officer to produce your insurance certificate and you do not have it with you, you have 7 days to produce it at a police station of your choice. This also applies to your driving licence and MOT certificate.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_004',
    questionText: 'What is the minimum insurance cover required by law to drive on UK roads?',
    options: [
      'Third party only',
      'Third party, fire, and theft',
      'Fully comprehensive',
      'Any level of cover from a registered insurer',
    ],
    correctIndex: 0,
    explanation:
      'The legal minimum is third party insurance. This covers injury or damage caused to other people and their property. It does not cover damage to your own vehicle. Driving without at least third party cover is a criminal offence.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 1,
  },
  {
    id: 'DOC_005',
    questionText: 'When must a vehicle first have an MOT?',
    options: [
      'After one year from first registration',
      'After two years from first registration',
      'After three years from first registration',
      'After four years from first registration',
    ],
    correctIndex: 2,
    explanation:
      'Most vehicles must have their first MOT when they are three years old. After that, an annual MOT is required. Some older vehicles classified as historic may be exempt.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 1,
  },
  {
    id: 'DOC_006',
    questionText: 'What is the DVLA database called that allows police to check if a vehicle is insured?',
    options: [
      'ANPR (Automatic Number Plate Recognition)',
      'MID (Motor Insurance Database)',
      'V5C online verification service',
      'CATS (Claims and Tracking System)',
    ],
    correctIndex: 1,
    explanation:
      'The Motor Insurance Database (MID) holds details of all insured vehicles. Police use ANPR cameras to check number plates against the MID instantly. Uninsured vehicles can be seized on the spot.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_007',
    questionText: 'What is the document known as a V5C?',
    options: [
      'The vehicle\'s MOT certificate',
      'The vehicle registration certificate, showing who is registered keeper',
      'The vehicle insurance policy schedule',
      'A certificate of road worthiness issued by a garage',
    ],
    correctIndex: 1,
    explanation:
      'The V5C is the Vehicle Registration Certificate (logbook). It records the registered keeper and vehicle details. Note: it does not prove ownership. You must notify the DVLA when you sell or change keeper details.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_008',
    questionText: 'How many penalty points are given for driving without insurance?',
    options: [
      '3 points',
      '6 points',
      '8 points',
      '10 points',
    ],
    correctIndex: 1,
    explanation:
      'Driving without insurance carries 6 penalty points and an unlimited fine. Courts may also disqualify the driver. The police may seize the vehicle immediately if it is found to be uninsured.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_009',
    questionText: 'A new driver passes their test and receives 6 or more penalty points within 2 years of passing. What happens to their licence?',
    options: [
      'They receive a formal warning but keep their licence',
      'Their licence is revoked and they must reapply for a provisional licence and pass both tests again',
      'They are disqualified for 6 months only',
      'Their licence is downgraded to a provisional for 12 months',
    ],
    correctIndex: 1,
    explanation:
      'Under the New Drivers Act, if a driver accumulates 6 or more penalty points within 2 years of passing their test, their licence is automatically revoked. They must then re-apply for a provisional licence and pass both the theory and practical tests again.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_010',
    questionText: 'You change your address. What must you do regarding your driving licence?',
    options: [
      'Nothing - the DVLA will update your records automatically',
      'Notify the DVLA and update your photocard driving licence with your new address',
      'Notify your insurer only - the DVLA does not need informing',
      'Update the licence at your next renewal point',
    ],
    correctIndex: 1,
    explanation:
      'You must notify the DVLA when you change your address and update your photocard licence. Failing to keep your licence address current is an offence. You should also inform your insurance company.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_011',
    questionText: 'What is the legal requirement for number plates on a vehicle registered after 2001?',
    options: [
      'Plates must be white at the front and yellow at the rear, with black characters in the prescribed font',
      'Plates may be any colour as long as the registration is clearly legible',
      'Plates must be white front and rear with reflective characters',
      'Plates must show the manufacturer\'s country code and be at least 500mm wide',
    ],
    correctIndex: 0,
    explanation:
      'Number plates must be white at the front and yellow at the rear. Characters must be black, in the legally prescribed font size and style, and not italicised or stylised. Plates that obscure the registration are illegal.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_012',
    questionText: 'What does SORN stand for and when is it required?',
    options: [
      'Statutory Off Road Notification - when a vehicle is kept off public roads and not being driven or kept on a public road',
      'Standard Official Road Notice - when you cannot afford road tax',
      'Safety Off Road Notice - when a vehicle fails its MOT',
      'Statutory Ownership Record Notice - when you buy a secondhand vehicle',
    ],
    correctIndex: 0,
    explanation:
      'SORN (Statutory Off Road Notification) must be declared if your vehicle is kept off public roads and not taxed. A SORN vehicle must not be used on the public road. You can declare SORN online via the DVLA.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_013',
    questionText: 'How many penalty points can a driver accumulate before facing automatic disqualification?',
    options: [
      '9 points',
      '12 points',
      '15 points',
      '18 points',
    ],
    correctIndex: 1,
    explanation:
      'Accumulating 12 or more penalty points within a 3-year period results in automatic disqualification for a minimum of 6 months. Courts may impose longer bans or additional conditions.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_014',
    questionText: 'What medical conditions must you tell the DVLA about?',
    options: [
      'Only conditions that have been confirmed as permanent by a GP',
      'Any condition that may affect your fitness to drive, such as epilepsy, severe vision problems, or certain heart conditions',
      'Only conditions for which you take prescription medication',
      'The DVLA does not need to be informed of medical conditions',
    ],
    correctIndex: 1,
    explanation:
      'You must inform the DVLA of any medical condition that affects your ability to drive safely. These are called "notifiable" conditions and include epilepsy, diabetes controlled by insulin, severe heart conditions, and visual impairments. Failure to notify is a criminal offence.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_015',
    questionText: 'What is the consequence of using a vehicle on a public road without a current MOT certificate?',
    options: [
      'A formal warning letter from DVLA',
      'A fine and points on your licence, and your insurance may be invalidated',
      'Your licence is revoked immediately',
      'You are only liable if you are involved in a collision',
    ],
    correctIndex: 1,
    explanation:
      'Driving without a valid MOT is an offence carrying a fine of up to 1,000 pounds. Crucially, many insurance policies are voided without a valid MOT, leaving you uninsured. The only exception is driving to a pre-booked MOT test.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_016',
    questionText: 'What is the legal alcohol limit for drivers in England, Wales, and Northern Ireland?',
    options: [
      '35 micrograms per 100 millilitres of breath',
      '50 micrograms per 100 millilitres of breath',
      '80 milligrams per 100 millilitres of blood',
      '35 micrograms per 100 millilitres of breath, OR 80 milligrams per 100 millilitres of blood',
    ],
    correctIndex: 3,
    explanation:
      'The legal limit in England, Wales, and Northern Ireland is 35 micrograms per 100ml of breath, 80mg per 100ml of blood, or 107mg per 100ml of urine. Scotland has a lower limit of 22mcg per 100ml breath, 50mg per 100ml blood. The only safe approach is not to drink at all if driving.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_017',
    questionText: 'What are the minimum eyesight requirements for holding a driving licence?',
    options: [
      'Reading a number plate in good daylight at 20 metres',
      'Reading a new-style number plate at 20 metres in good daylight',
      'Passing a GP eye examination every 5 years',
      'Reading a standard-size book at arm\'s length',
    ],
    correctIndex: 1,
    explanation:
      'You must be able to read a new-style number plate (post-September 2001, characters 79mm high) at a distance of 20 metres in good daylight, with glasses or contact lenses if worn. Failing to meet this standard is a criminal offence. You must report any worsening vision that affects driving to the DVLA.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_018',
    questionText: 'What is Vehicle Excise Duty (VED), and what does it fund?',
    options: [
      'An annual charge on the vehicle, popularly known as road tax, paid to DVLA',
      'A fee paid to local councils for road maintenance in the driver\'s area',
      'A charge based on the distance driven per year, collected via fuel duty',
      'A one-off payment made when a vehicle is first registered in the UK',
    ],
    correctIndex: 0,
    explanation:
      'Vehicle Excise Duty (VED) - commonly called road tax - is an annual charge on vehicles kept or used on public roads. It is paid to HMRC via the DVLA. The amount depends on CO2 emissions for newer vehicles. It goes into general government funds, not specifically ring-fenced for roads.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_019',
    questionText: 'What penalty can be imposed for drink-driving, in addition to points on the licence?',
    options: [
      'A maximum fine of £1,000 and 3 penalty points',
      'A mandatory minimum 12-month driving ban, unlimited fine, and up to 6 months imprisonment',
      'A fine of £500 and a requirement to attend a drink-drive rehabilitation course',
      '6 penalty points and a 6-month disqualification',
    ],
    correctIndex: 1,
    explanation:
      'Drink-driving carries a mandatory minimum 12-month driving ban (3 years for a second offence within 10 years), an unlimited fine, and up to 6 months imprisonment. A criminal record is issued. For causing death by careless driving while over the limit, the sentence is up to 14 years imprisonment.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_020',
    questionText: 'What is the minimum age to drive an articulated lorry (Category CE) in the UK?',
    options: [
      '17',
      '18',
      '21',
      '25',
    ],
    correctIndex: 2,
    explanation:
      'The minimum age to hold a Category CE licence (articulated lorry) is 21. However, under the Driver Certificate of Professional Competence (CPC) scheme, drivers aged 18 who are undergoing CPC training may drive Category C vehicles. The standard minimum for CE remains 21.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_021',
    questionText: 'How long do penalty points remain on a driving licence for a standard endorsable offence?',
    options: [
      '3 years from the date of conviction',
      '4 years from the date of the offence',
      '5 years from the date of conviction',
      '10 years from the date of conviction',
    ],
    correctIndex: 1,
    explanation:
      'For most standard endorsable offences, penalty points remain on the licence for 4 years from the date of the offence (not the conviction). For more serious offences such as drink-driving, they remain for 11 years. The points count towards the 12-point totting-up threshold for the duration they are "live".',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_022',
    questionText: 'What does the licence category "B" cover in the UK driving licence system?',
    options: [
      'Motorcycles up to 125cc',
      'Motor vehicles up to 3,500kg with up to 8 passenger seats (standard car)',
      'Minibuses and people carriers with up to 16 seats',
      'Light goods vehicles between 3,500kg and 7,500kg',
    ],
    correctIndex: 1,
    explanation:
      'Category B covers motor vehicles with a maximum authorised mass (MAM) of up to 3,500kg with no more than 8 passenger seats. This is the standard car category. It also includes driving certain vehicles with a trailer up to 750kg. Category BE covers cars with heavier trailers.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_023',
    questionText: 'Can a driver with a full UK Category B licence drive a vehicle towing a trailer that weighs more than 750kg?',
    options: [
      'Yes - Category B covers towing any trailer',
      'No - they need Category BE for trailers over 750kg maximum authorised mass',
      'Yes, provided the total combined weight is under 3,500kg',
      'No - towing any trailer requires a Category C licence',
    ],
    correctIndex: 1,
    explanation:
      'Category B allows towing trailers up to 750kg MAM. For trailers above 750kg, and where the combined vehicle and trailer weight exceeds 3,500kg, a Category BE licence is required. This typically covers towing caravans and heavier boat trailers.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_024',
    questionText: 'What is a "totting-up" disqualification?',
    options: [
      'A disqualification imposed when a driver accumulates 12 or more penalty points over a 3-year period',
      'An extended ban applied when a driver has committed three or more different categories of offence',
      'A disqualification given to drivers who exceed the speed limit by more than 50%',
      'A ban imposed when a driver is involved in three or more collisions',
    ],
    correctIndex: 0,
    explanation:
      'Totting-up disqualification occurs when a driver accumulates 12 or more penalty points within any 3-year period. The court must impose a minimum 6-month disqualification unless there are exceptional hardship reasons not to. A driver who has already been disqualified once faces longer minimums.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_025',
    questionText: 'What is the penalty for driving while disqualified?',
    options: [
      'A fine and 3 additional penalty points',
      'An unlimited fine, up to 6 months imprisonment, and further disqualification',
      'Confiscation of the vehicle only',
      'A fine of £5,000 and suspension of the disqualification period',
    ],
    correctIndex: 1,
    explanation:
      'Driving while disqualified is a serious criminal offence. Penalties include an unlimited fine, up to 6 months imprisonment, and further driving disqualification. The police can also seize the vehicle. A criminal record will follow conviction.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_026',
    questionText: 'When you buy a used car, what document should you ensure has been completed by the seller to transfer registered keepership?',
    options: [
      'The V5C registration certificate - the new keeper slip (section 6) must be torn off and kept by the buyer',
      'The vehicle\'s service history and stamp book',
      'A signed declaration from the seller confirming no outstanding finance',
      'A DVLA transfer form obtained from a post office',
    ],
    correctIndex: 0,
    explanation:
      'When buying a used car, ask the seller to complete the V5C new keeper slip (section 6 or the green keeper slip) and keep it until your updated V5C arrives. The seller must send the remainder of the V5C to the DVLA. Also check there is no outstanding finance on the vehicle.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_027',
    questionText: 'What is the fixed penalty for using a hand-held mobile phone while driving?',
    options: [
      '£100 and 3 penalty points',
      '£200 and 6 penalty points',
      '£500 and 3 penalty points',
      '£1,000 and 6 penalty points',
    ],
    correctIndex: 1,
    explanation:
      'Since March 2022, the fixed penalty for using a hand-held mobile phone while driving is £200 and 6 penalty points. New drivers who accrue 6 points within 2 years of passing their test have their licence revoked. Court prosecution can result in higher fines.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_028',
    questionText: 'What is the minimum penalty for speeding on a public road in the UK?',
    options: [
      '1 penalty point and a £50 fine',
      '3 penalty points and a £100 fixed penalty',
      '6 penalty points and a £200 fixed penalty',
      '3 penalty points and a £60 fixed penalty',
    ],
    correctIndex: 1,
    explanation:
      'The minimum penalty for speeding is a £100 fixed penalty notice and 3 penalty points. For extreme speeding, courts can impose higher fines (up to 175% of weekly income), longer bans, or more points. Drivers may be offered a speed awareness course instead of a fixed penalty in some cases.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_029',
    questionText: 'What are the penalties for running a red traffic light?',
    options: [
      '2 penalty points and a £50 fine',
      '3 penalty points and a £100 fixed penalty',
      '6 penalty points and a £200 fixed penalty',
      '3 penalty points and a formal warning',
    ],
    correctIndex: 1,
    explanation:
      'Failing to stop at a red traffic light carries a fixed penalty of £100 and 3 penalty points. If the case goes to court (e.g., due to the driver not accepting the fixed penalty), fines can be much higher. Red light cameras are used at many junctions to enforce this automatically.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_030',
    questionText: 'What is the purpose of a speed awareness course, and who can be offered one?',
    options: [
      'It is a mandatory punishment for all speeding offences and replaces points on the licence',
      'It is an educational course offered as an alternative to fixed penalty points, for drivers caught marginally over the limit with a clean record',
      'It is required before driving test candidates are allowed to sit the hazard perception test',
      'It is for drivers who have accumulated 9 penalty points and wish to avoid disqualification',
    ],
    correctIndex: 1,
    explanation:
      'A speed awareness course can be offered by police as an alternative to 3 points and a £100 fine for drivers caught mildly speeding. Eligibility varies by force but typically requires no recent speeding convictions. Completing the course does not add points but the driver pays a course fee.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_031',
    questionText: 'What are the L-plate requirements for a learner driver in England?',
    options: [
      'L-plates must be displayed front and rear and must not be driven at night',
      'L-plates must be displayed front and rear at all times when driving on public roads as a learner',
      'L-plates are only required on motorways and dual carriageways',
      'Only a rear L-plate is required by law',
    ],
    correctIndex: 1,
    explanation:
      'Learner drivers in England and Wales must display red L-plates at the front and rear of the vehicle whenever they drive on public roads. The plates must be clearly visible and not obscured. They must be removed or covered when a fully-qualified driver is using the vehicle alone.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 1,
  },
  {
    id: 'DOC_032',
    questionText: 'What qualifications must a person have to supervise a learner driver?',
    options: [
      'They must be over 21 and have held a full UK driving licence for at least 3 years',
      'They must have held a full licence for at least 2 years with no more than 3 penalty points',
      'They must be an approved driving instructor (ADI)',
      'Any person with a full driving licence may supervise a learner',
    ],
    correctIndex: 0,
    explanation:
      'A supervising driver must be at least 21 years old and have held a full UK driving licence for the category being driven for at least 3 years. They do not need to be a professional instructor. The supervisor must be fit to drive (not over the alcohol limit) and must sit in the front passenger seat.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_033',
    questionText: 'What is drug driving, and what are the approximate penalties?',
    options: [
      'Driving after taking any prescribed medication - a fixed penalty of 3 points and £100',
      'Driving while impaired by drugs (legal or illegal) - penalties equivalent to drink-driving including a minimum 12-month ban',
      'Driving while legally medicated - no offence if a doctor has prescribed the medication',
      'Only illegal drug use while driving - prescription drugs are exempt from prosecution',
    ],
    correctIndex: 1,
    explanation:
      'Drug driving (driving while impaired by drugs, or with certain illegal drugs above specified blood limits) carries the same penalties as drink-driving: a mandatory minimum 12-month disqualification, unlimited fine, up to 6 months imprisonment, and a criminal record. Legal prescription drugs can still impair driving and lead to prosecution if you are unfit to drive.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_034',
    questionText: 'What must you tell the DVLA if you develop a medical condition that may affect your driving?',
    options: [
      'You only need to tell the DVLA if your GP instructs you to stop driving',
      'You must inform the DVLA yourself, and stop driving if the condition may make you a danger',
      'Telling your insurance company is sufficient',
      'The hospital will inform the DVLA automatically after any medical treatment',
    ],
    correctIndex: 1,
    explanation:
      'It is your legal responsibility to inform the DVLA of any condition that may affect your fitness to drive. Your GP will advise, but it is your duty to notify the DVLA. You should stop driving while the condition is under assessment if there is doubt about your fitness. Failure to disclose is a criminal offence.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_035',
    questionText: 'What is Continuous Insurance Enforcement (CIE)?',
    options: [
      'A policy requiring insurers to renew policies automatically each year',
      'A system that matches DVLA vehicle records against the Motor Insurance Database and issues penalties to uninsured vehicles even when not on the road',
      'Police enforcement targeting uninsured drivers at specific checkpoints',
      'A requirement for insurers to increase cover automatically when new drivers are added to a policy',
    ],
    correctIndex: 1,
    explanation:
      'Continuous Insurance Enforcement (CIE) means that all registered vehicles must be insured at all times unless a SORN has been declared. DVLA cross-references its vehicle register with the MID. Uninsured registered keepers receive a fixed penalty automatically, even if the car is parked and not in use.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_036',
    questionText: 'What information must a driver provide to another party after a road traffic collision involving injury or damage?',
    options: [
      'Name only - address is optional for privacy reasons',
      'Name, address, and vehicle registration number',
      'Name, address, vehicle registration, and insurance details',
      'Name, address, vehicle registration, insurance details, and driving licence number',
    ],
    correctIndex: 2,
    explanation:
      'After a collision, you must stop and, if asked, provide your name, address, vehicle registration number, and the name and address of the registered owner (if different). If you do not provide insurance details at the scene, you must report the collision to police within 24 hours and produce your certificate of insurance.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_037',
    questionText: 'When must a road traffic collision be reported to the police?',
    options: [
      'Only when a person is killed',
      'Whenever a collision results in injury to any person, or damage to certain property such as animals',
      'Always, regardless of whether any injury or damage occurred',
      'Only when the other driver does not have insurance',
    ],
    correctIndex: 1,
    explanation:
      'You must report a collision to police within 24 hours if: a person (other than yourself) is injured, or the collision involved certain animals (horse, cattle, sheep, pig, goat, dog, ass, mule) or certain property. You must also report it if you did not exchange details at the scene. Failure to stop and report is a criminal offence.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_038',
    questionText: 'What is the purpose of a tachograph in a lorry or bus?',
    options: [
      'To measure fuel consumption and emission levels for environmental compliance',
      'To record speed, distance, and hours of driving to enforce drivers\' hours regulations',
      'To transmit the vehicle\'s location to the employer in real time',
      'To automatically alert police when a vehicle exceeds the speed limit',
    ],
    correctIndex: 1,
    explanation:
      'A tachograph records speed, driving time, breaks, and rest periods. EU and UK law requires it in most goods vehicles over 3.5 tonnes and passenger vehicles carrying 9 or more people for hire or reward. It allows enforcement of drivers\' hours rules, which limit how long a driver can be behind the wheel without a rest.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_039',
    questionText: 'What happens if you fail the driving theory test?',
    options: [
      'You can retake it immediately at the same test centre',
      'You must wait 3 working days before retaking the test, and pay the fee again',
      'You must wait 3 months and receive extra tuition before being eligible to retake',
      'You receive two more attempts before a mandatory waiting period applies',
    ],
    correctIndex: 1,
    explanation:
      'If you fail the theory test, you must wait a minimum of 3 clear working days before you can book and retake it. There is no limit on how many times you can take the test, but the fee must be paid each time. A theory test pass certificate is valid for 2 years.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_040',
    questionText: 'For how long is a theory test pass certificate valid?',
    options: [
      '6 months',
      '1 year',
      '2 years',
      '3 years',
    ],
    correctIndex: 2,
    explanation:
      'A theory test pass certificate is valid for 2 years from the date of passing. You must pass your practical driving test within this 2-year period. If your practical test has not been passed within 2 years, you must retake and pass the theory test again before applying for another practical test.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 1,
  },
  {
    id: 'DOC_041',
    questionText: 'What are the two parts of the UK driving theory test?',
    options: [
      'A written paper and a hazard awareness practical assessment',
      'A multiple-choice test and a hazard perception test',
      'A video-based awareness test and a Highway Code examination',
      'A general knowledge test and a specific vehicle knowledge test',
    ],
    correctIndex: 1,
    explanation:
      'The UK driving theory test for car drivers has two parts: (1) a multiple-choice section with 50 questions requiring a minimum of 43 correct answers to pass, and (2) a hazard perception section with 14 video clips requiring a minimum score of 44 out of 75. Both parts must be passed in the same sitting.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 1,
  },
  {
    id: 'DOC_042',
    questionText: 'Can a person with a full EU driving licence drive in the UK?',
    options: [
      'Yes, but only for 3 months before it must be exchanged for a UK licence',
      'Yes, a full EU/EEA licence is recognised for driving in the UK until age 70, then it must be exchanged',
      'No - all foreign licences must be immediately exchanged for a UK licence',
      'Only if the licence was issued before Brexit in 2021',
    ],
    correctIndex: 1,
    explanation:
      'Following Brexit, a full EU/EEA driving licence is recognised in the UK for driving until the licence expires or until the holder reaches age 70 (whichever is sooner). After that period, it should be exchanged for a UK licence if the holder wishes to continue driving. Non-EEA licences have different rules.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_043',
    questionText: 'What does a Fixed Penalty Notice (FPN) allow you to do, compared to being taken to court?',
    options: [
      'An FPN means no criminal record - there is no option to go to court instead',
      'An FPN offers the opportunity to pay a set fine and accept penalty points without a court appearance, but you may elect to go to court instead',
      'An FPN is more serious than a court summons as it goes on the Police National Computer immediately',
      'An FPN applies only to parking offences and has no effect on your driving licence',
    ],
    correctIndex: 1,
    explanation:
      'A Fixed Penalty Notice allows you to pay a set fine and accept penalty points without going to court. If you do not accept the FPN, you can contest the offence in court, where the penalty may be higher if you are found guilty. Accepting an FPN for endorsable offences results in points being added to your licence.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_044',
    questionText: 'What happens to an uninsured vehicle found by police?',
    options: [
      'The driver receives a verbal warning and is asked to obtain insurance within 7 days',
      'The vehicle can be seized immediately by police and may be crushed if not claimed',
      'The driver is issued a £100 fixed penalty only',
      'The vehicle is clamped until insurance is arranged',
    ],
    correctIndex: 1,
    explanation:
      'Police have the power to seize and remove uninsured vehicles immediately. If the vehicle is not claimed and insured within a set period, it may be disposed of (including crushing). The driver also faces prosecution, a fixed penalty, and potentially further disqualification.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_045',
    questionText: 'What is a "telematics" or "black box" insurance policy?',
    options: [
      'A specialist insurance type available only to HGV drivers',
      'A policy where a device fitted to the vehicle monitors driving behaviour to calculate premiums based on actual driving',
      'An insurance policy that uses satellite tracking to recover stolen vehicles',
      'A fleet management system for company vehicles',
    ],
    correctIndex: 1,
    explanation:
      'Telematics (black box) insurance fits a device in the vehicle that records data such as speed, braking, cornering, and the time of day you drive. Premiums are calculated based on how safely you actually drive. They are popular with young drivers as they can reduce the cost of insurance if the driver demonstrates safe habits.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_046',
    questionText: 'What is the penalty for causing death by dangerous driving?',
    options: [
      'A maximum of 5 years imprisonment and a 2-year driving ban',
      'A maximum of 14 years imprisonment and a minimum 2-year driving ban',
      'A maximum of 10 years imprisonment and an indefinite driving ban',
      'A maximum of 7 years imprisonment and a 5-year driving ban',
    ],
    correctIndex: 1,
    explanation:
      'Causing death by dangerous driving carries a maximum sentence of 14 years imprisonment and a minimum 2-year driving disqualification, after which an extended retest must be passed. Dangerous driving (no death) carries up to 2 years imprisonment.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 3,
  },
  {
    id: 'DOC_047',
    questionText: 'What is the minimum disqualification period for a first-time drink-drive conviction?',
    options: [
      '6 months',
      '12 months',
      '18 months',
      '24 months',
    ],
    correctIndex: 1,
    explanation:
      'A first-time drink-drive conviction carries a mandatory minimum disqualification of 12 months. For a second offence within 10 years, the minimum ban is 3 years. Courts can impose longer bans based on the severity of the offence. A drink-drive rehabilitation course can reduce the ban by 25%.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_048',
    questionText: 'How long after passing the practical driving test must a new driver avoid accumulating 6 or more penalty points?',
    options: [
      '1 year',
      '2 years',
      '3 years',
      '5 years',
    ],
    correctIndex: 1,
    explanation:
      'Under the Road Traffic (New Drivers) Act 1995, a new driver\'s licence is revoked automatically if they accumulate 6 or more penalty points within 2 years of passing their first practical driving test. They must then retake and pass both the theory and practical tests to regain a full licence.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_049',
    questionText: 'What documentation must a vehicle owner have to legally use their vehicle on a public road?',
    options: [
      'A valid driving licence and insurance certificate only',
      'Valid vehicle tax (VED), insurance, and MOT (for vehicles over 3 years old)',
      'Valid insurance and a roadworthiness certificate from an approved garage',
      'A valid driving licence, insurance, and V5C registration document',
    ],
    correctIndex: 1,
    explanation:
      'To legally use a vehicle on a public road, you need: valid vehicle tax (VED), at least third party insurance, and a valid MOT certificate (once the vehicle is over 3 years old). You must also be a licensed driver. The V5C does not need to be carried but the vehicle must be registered.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 2,
  },
  {
    id: 'DOC_050',
    questionText: 'What is the legal requirement regarding seat belts in a car for front-seat passengers?',
    options: [
      'Adults may choose not to wear a seat belt - it is their personal responsibility',
      'All front-seat occupants must wear a seat belt unless they hold a valid medical exemption certificate',
      'Seat belts are only compulsory in motorway driving',
      'Children under 12 must wear a belt; adults over 18 may choose',
    ],
    correctIndex: 1,
    explanation:
      'All front-seat occupants must wear a seat belt unless they hold a medical exemption certificate signed by a doctor. Rear-seat occupants must also wear belts where fitted. Drivers are responsible for ensuring passengers under 14 wear a belt. Adults who fail to belt up are personally liable to a fine.',
    topicCategory: TopicCategory.DocumentsAndRegulations,
    difficulty: 1,
  },
];
