export const BLOCKS = {
  startup: { name: "Startup", targetNonTowered: "CTAF/UNICOM", targetTowered: "ATIS" },
  clearance_delivery: { name: "Clearance Delivery", targetNonTowered: null, targetTowered: "Clearance Delivery" },
  taxi_out: { name: "Taxi Out", targetNonTowered: "CTAF", targetTowered: "Ground" },
  runup: { name: "Run-Up", targetNonTowered: "Self", targetTowered: "Self" },
  takeoff: { name: "Takeoff", targetNonTowered: "CTAF", targetTowered: "Tower" },
  departure: { name: "Departure", targetNonTowered: "CTAF", targetTowered: "Tower/Departure" },
  climbout: { name: "Climbout", targetNonTowered: "CTAF", targetTowered: "Tower/Departure" },
  enroute: { name: "Enroute", targetNonTowered: "Center/Approach", targetTowered: "Center/Approach" },
  holding: { name: "Holding", targetNonTowered: "Center/Approach", targetTowered: "Center/Approach" },
  descent: { name: "Descent/Arrival", targetNonTowered: "CTAF", targetTowered: "Approach/ATIS" },
  pattern: { name: "Traffic Pattern", targetNonTowered: "CTAF", targetTowered: "Tower" },
  approach: { name: "Approach", targetNonTowered: "CTAF", targetTowered: "Approach" },
  landing: { name: "Landing", targetNonTowered: "CTAF", targetTowered: "Tower" },
  taxi_in: { name: "Taxi In", targetNonTowered: "CTAF", targetTowered: "Ground" },
  shutdown: { name: "Shutdown", targetNonTowered: "CTAF", targetTowered: "Ground" },
  emergency: { name: "Emergency", targetNonTowered: "121.5/Current", targetTowered: "121.5/Current" },
};

export const BLOCK_ORDER = [
  'startup', 'clearance_delivery', 'taxi_out', 'runup', 'takeoff', 'departure', 'climbout',
  'enroute', 'holding', 'descent', 'pattern', 'approach', 'landing', 'taxi_in',
  'shutdown', 'emergency'
];

// Blocks that use departure airport's tower status
export const DEPARTURE_BLOCKS = ['startup', 'clearance_delivery', 'taxi_out', 'runup', 'takeoff', 'departure', 'climbout'];
// Blocks that use arrival airport's tower status
export const ARRIVAL_BLOCKS = ['descent', 'pattern', 'approach', 'landing', 'taxi_in', 'shutdown'];
export const ENROUTE_BLOCKS = ['enroute', 'holding'];
export const EMERGENCY_BLOCKS = ['emergency'];
