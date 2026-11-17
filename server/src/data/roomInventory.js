// Starting room inventory for the hotel: five room types and 100 rooms
// numbered 001–100 floor by floor (10 rooms per floor). Every floor is
// dedicated to one room type, and the five types repeat across floors 1–10.
// The owner can edit rates, descriptions, amenities and views after setup.

export const roomTypeSeed = [
  {
    name: 'Standard King',
    description:
      'A calm, light-filled room with a plush king bed, marble bath and everything you need for an effortless stay.',
    baseRate: 220,
    capacity: 2,
    beds: '1 King',
    sizeSqm: 32,
    amenities: ['High-speed Wi-Fi', '55" Smart TV', 'Nespresso machine', 'Rain shower', 'Work desk', 'In-room safe'],
    accent: 'sage',
  },
  {
    name: 'Deluxe Ocean View',
    description:
      'Wake up to the view from a private balcony, with a spacious lounge corner and refined natural textures.',
    baseRate: 320,
    capacity: 2,
    beds: '1 King',
    sizeSqm: 42,
    amenities: ['Private balcony', 'High-speed Wi-Fi', '55" Smart TV', 'Nespresso machine', 'Minibar', 'Soaking tub', 'Bathrobes'],
    accent: 'ocean',
  },
  {
    name: 'Executive Suite',
    description:
      'A generous suite with a separate living room, private dining nook and access to the Executive Lounge.',
    baseRate: 480,
    capacity: 3,
    beds: '1 King + sofa bed',
    sizeSqm: 65,
    amenities: ['Executive Lounge access', 'Separate living room', 'Private balcony', 'Wi-Fi', '65" Smart TV', 'Minibar', 'Evening turndown'],
    accent: 'gold',
  },
  {
    name: 'Family Residence',
    description:
      'Two connected bedrooms, a relaxed family lounge and thoughtful touches for younger travellers.',
    baseRate: 420,
    capacity: 4,
    beds: '2 Queen beds',
    sizeSqm: 70,
    amenities: ['Two bedrooms', 'Family lounge', 'Board games', 'Kids amenities', 'Wi-Fi', '65" Smart TV', 'Minibar'],
    accent: 'terracotta',
  },
  {
    name: 'Presidential Suite',
    description:
      'The pinnacle of comfort: a panoramic terrace, private butler service and an address for the extraordinary.',
    baseRate: 950,
    capacity: 4,
    beds: '2 King beds',
    sizeSqm: 120,
    amenities: ['Private butler', 'Panoramic terrace', 'Private dining room', 'Grand piano', 'Spa bath', 'Chauffeur service', 'Executive Lounge access'],
    accent: 'plum',
  },
];

// Each floor is dedicated to a single room type. The five types repeat
// across the ten floors, so every type appears on two floors (20 rooms).
const ROOMS_PER_FLOOR = 10;

const floorLayout = [
  { floor: 1, view: 'Garden view', type: 'Standard King' },
  { floor: 2, view: 'City view', type: 'Deluxe Ocean View' },
  { floor: 3, view: 'Garden view', type: 'Executive Suite' },
  { floor: 4, view: 'Garden view', type: 'Family Residence' },
  { floor: 5, view: 'City view', type: 'Presidential Suite' },
  { floor: 6, view: 'City view', type: 'Standard King' },
  { floor: 7, view: 'Courtyard view', type: 'Deluxe Ocean View' },
  { floor: 8, view: 'Courtyard view', type: 'Executive Suite' },
  { floor: 9, view: 'City view', type: 'Family Residence' },
  { floor: 10, view: 'Panoramic view', type: 'Presidential Suite' },
];

export const roomPlan = floorLayout.flatMap(({ floor, view, type }) =>
  Array.from({ length: ROOMS_PER_FLOOR }, (_, index) => ({
    number: String((floor - 1) * ROOMS_PER_FLOOR + index + 1).padStart(3, '0'),
    floor,
    type,
    view,
  }))
);
