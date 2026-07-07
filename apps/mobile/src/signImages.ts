// Static image map for DVSA road sign JPGs.
// All require() calls must use literal paths — Metro resolves them at bundle time.
// Signs not listed here fall back to SVG rendering in roadsigns.tsx.

const SIGN_IMAGES: Record<string, any> = {

  // ── Warning signs (root assets/signs folder) ─────────────────────────────
  'crossroads':           require('../assets/signs/504.1.jpg'),
  't-junction':           require('../assets/signs/505.1.jpg'),
  'side-road-right':      require('../assets/signs/505.1R.jpg'),
  'roundabout-warning':   require('../assets/signs/510.jpg'),
  'sharp-bend-left':      require('../assets/signs/512L.jpg'),
  'sharp-bend-right':     require('../assets/signs/512.jpg'),
  'double-bend-left':     require('../assets/signs/513.jpg'),
  'staggered-junction':   require('../assets/signs/507.1RL.jpg'),
  'steep-descent':        require('../assets/signs/524.1.jpg'),
  'steep-ascent':         require('../assets/signs/523.1.jpg'),
  'uneven-road':          require('../assets/signs/556.jpg'),
  'traffic-signals':      require('../assets/signs/543.jpg'),
  'road-narrows-both':    require('../assets/signs/516.jpg'),
  'road-narrows-right':   require('../assets/signs/517.jpg'),
  'slippery-road':        require('../assets/signs/557.jpg'),
  'pedestrians-road':     require('../assets/signs/544.jpg'),
  'children':             require('../assets/signs/545.jpg'),
  'humpback-bridge':      require('../assets/signs/528.jpg'),
  'quayside':             require('../assets/signs/555.jpg'),
  'two-way-traffic-ahead':require('../assets/signs/521.jpg'),
  'ford':                 require('../assets/signs/554.jpg'),
  'opening-bridge':       require('../assets/signs/529.jpg'),
  'low-aircraft':         require('../assets/signs/558.jpg'),
  'wild-animals':         require('../assets/signs/551.jpg'),
  'farm-animals':         require('../assets/signs/548.jpg'),
  'falling-rocks':        require('../assets/signs/559.jpg'),
  'horse-riders':         require('../assets/signs/550.1.jpg'),
  'elderly-people':       require('../assets/signs/544.2.jpg'),
  'risk-of-grounding':    require('../assets/signs/583.jpg'),
  'risk-of-ice':          require('../assets/signs/554.2.jpg'),
  'tunnel':               require('../assets/signs/529.1.jpg'),
  'school-crossing':      require('../assets/signs/545.jpg'),

  // ── Level crossing signs ──────────────────────────────────────────────────
  'level-crossing-barriers':    require('../assets/signs/level-crossing-signs-jpg/770.jpg'),
  'level-crossing-no-barriers': require('../assets/signs/level-crossing-signs-jpg/771.jpg'),
  'level-crossing-countdown-3': require('../assets/signs/level-crossing-signs-jpg/789.jpg'),
  'level-crossing-countdown-2': require('../assets/signs/level-crossing-signs-jpg/789.1.jpg'),
  'level-crossing-countdown-1': require('../assets/signs/level-crossing-signs-jpg/789.2.jpg'),

  // ── Speed limit signs ────────────────────────────────────────────────────
  'speed-20':             require('../assets/signs/speed-limit-signs-jpg/670V20.jpg'),
  'speed-30':             require('../assets/signs/speed-limit-signs-jpg/670V30.jpg'),
  'speed-40':             require('../assets/signs/speed-limit-signs-jpg/670.jpg'),
  'speed-50':             require('../assets/signs/speed-limit-signs-jpg/670V50.jpg'),
  'speed-60':             require('../assets/signs/speed-limit-signs-jpg/670V60.jpg'),
  'national-speed-limit': require('../assets/signs/speed-limit-signs-jpg/671.jpg'),
  'end-speed-restriction':require('../assets/signs/speed-limit-signs-jpg/672.jpg'),
  'zone-30-entry':        require('../assets/signs/speed-limit-signs-jpg/674.jpg'),

  // ── Regulatory / prohibition signs ───────────────────────────────────────
  'stop-sign':            require('../assets/signs/regulatory-signs-jpg/601.1.jpg'),
  'give-way':             require('../assets/signs/regulatory-signs-jpg/602.jpg'),
  'keep-left':            require('../assets/signs/regulatory-signs-jpg/606.jpg'),
  'keep-right':           require('../assets/signs/regulatory-signs-jpg/606B.jpg'),
  'turn-left-ahead':      require('../assets/signs/regulatory-signs-jpg/609.jpg'),
  'turn-right-ahead':     require('../assets/signs/regulatory-signs-jpg/609A.jpg'),
  'mini-roundabout':      require('../assets/signs/regulatory-signs-jpg/611.1.jpg'),
  'no-right-turn':        require('../assets/signs/regulatory-signs-jpg/612.jpg'),
  'no-left-turn':         require('../assets/signs/regulatory-signs-jpg/613.jpg'),
  'no-u-turns':           require('../assets/signs/regulatory-signs-jpg/614.jpg'),
  'no-entry':             require('../assets/signs/regulatory-signs-jpg/616.jpg'),
  'no-vehicles':          require('../assets/signs/regulatory-signs-jpg/617.jpg'),
  'no-cycling':           require('../assets/signs/bus-and-cycle-signs-jpg/951.jpg'),
  'no-motor-vehicles':    require('../assets/signs/regulatory-signs-jpg/619.jpg'),
  'no-overtaking':        require('../assets/signs/regulatory-signs-jpg/632.jpg'),
  'min-speed-30':         require('../assets/signs/regulatory-signs-jpg/651.jpg'),

  // ── Bus, cycle and pedestrian signs ──────────────────────────────────────
  'no-through-road':               require('../assets/signs/bus-and-cycle-signs-jpg/816.jpg'),
  'buses-cycles-only':             require('../assets/signs/bus-and-cycle-signs-jpg/953.jpg'),
  'cycles-only':                   require('../assets/signs/bus-and-cycle-signs-jpg/955.jpg'),
  'pedestrians-only':              require('../assets/signs/bus-and-cycle-signs-jpg/956.jpg'),
  'cycles-pedestrians-segregated': require('../assets/signs/bus-and-cycle-signs-jpg/957.jpg'),

  // ── Information signs ────────────────────────────────────────────────────
  'parking-place':        require('../assets/signs/information-signs-jpg/801.jpg'),
  'one-way-traffic':      require('../assets/signs/information-signs-jpg/810.jpg'),
  'hospital':             require('../assets/signs/information-signs-jpg/827.1.jpg'),
  'camera-ahead':         require('../assets/signs/speed-limit-signs-jpg/878.jpg'),

  // ── Motorway signs ───────────────────────────────────────────────────────
  'motorway-start':       require('../assets/signs/motorway-signs-jpg/2901.jpg'),
  'motorway-direction':   require('../assets/signs/motorway-signs-jpg/2902.jpg'),
  'end-motorway':         require('../assets/signs/motorway-signs-jpg/2903.jpg'),
  'variable-speed-limit': require('../assets/signs/motorway-signs-jpg/6001.jpg'),
  'countdown-300':        require('../assets/signs/motorway-signs-jpg/823.jpg'),
  'countdown-200':        require('../assets/signs/motorway-signs-jpg/824.jpg'),
  'countdown-100':        require('../assets/signs/motorway-signs-jpg/825.jpg'),

  // ── Direction / tourist signs ─────────────────────────────────────────────
  'primary-route-direction': require('../assets/signs/direction-and-tourist-signs-jpg/2025.jpg'),
  'local-route-direction':   require('../assets/signs/direction-and-tourist-signs-jpg/2301.jpg'),
  'tourist-attraction':      require('../assets/signs/direction-and-tourist-signs-jpg/2201.jpg'),

  // ── On-street parking / red route signs ──────────────────────────────────
  'red-route':            require('../assets/signs/on-street-parking-jpg/CW701.jpg'),

  // ── Road works signs ─────────────────────────────────────────────────────
  'road-works-ahead':       require('../assets/signs/road-works-and-temporary-jpg/7001.jpg'),
  'men-at-work':            require('../assets/signs/road-works-and-temporary-jpg/7001.1.jpg'),
  'loose-chippings':        require('../assets/signs/road-works-and-temporary-jpg/7009.jpg'),
  'width-restriction-works':require('../assets/signs/road-works-and-temporary-jpg/7012.jpg'),
  'contra-flow':            require('../assets/signs/road-works-and-temporary-jpg/7013.jpg'),
  'road-works-lights':      require('../assets/signs/road-works-and-temporary-jpg/7021.jpg'),
};

export default SIGN_IMAGES;
