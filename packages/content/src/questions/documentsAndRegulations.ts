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
];
