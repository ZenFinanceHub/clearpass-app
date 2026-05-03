import { HazardClip } from '@clearpass/core';

export const hazardClips: HazardClip[] = [
  {
    id: 'haz_001',
    title: 'Busy Town Centre',
    description:
      'A busy shopping area with pedestrians and parked vehicles. Watch for unexpected hazards from the pavement.',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    durationSec: 15,
    hazards: [{ startSec: 4, endSec: 10 }],
  },
  {
    id: 'haz_002',
    title: 'Rural Junction',
    description:
      'Approaching a rural crossroads. Be alert for vehicles emerging from side roads without warning.',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    durationSec: 15,
    hazards: [{ startSec: 3, endSec: 9 }],
  },
  {
    id: 'haz_003',
    title: 'Residential Street',
    description:
      'Driving through a residential area. Look out for cyclists and children near parked cars.',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    durationSec: 15,
    hazards: [{ startSec: 5, endSec: 11 }],
  },
  {
    id: 'haz_004',
    title: 'Dual Carriageway',
    description:
      'Travelling on a dual carriageway. Watch for vehicles merging and sudden lane changes ahead.',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    durationSec: 15,
    hazards: [{ startSec: 4, endSec: 10 }],
  },
  {
    id: 'haz_005',
    title: 'Country Road',
    description:
      'Navigating a winding country road. Be ready for hazards emerging around blind bends.',
    videoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    durationSec: 55,
    hazards: [{ startSec: 10, endSec: 20 }],
  },
];
