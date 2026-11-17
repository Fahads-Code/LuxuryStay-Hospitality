// Images are bundled with the app (client/public/images) so room photos always
// load, even when the browser cannot reach an external image CDN.
const asset = (file) => `${import.meta.env.BASE_URL}images/${file}`;

export const roomImages = {
  'Standard King': asset('room-standard-king.jpg'),
  'Deluxe Ocean View': asset('room-deluxe-ocean-view.jpg'),
  'Executive Suite': asset('room-executive-suite.jpg'),
  'Family Residence': asset('room-family-residence.jpg'),
  'Presidential Suite': asset('room-presidential-suite.jpg'),
};

export const fallbackRoomImage = roomImages['Standard King'];

export const roomImage = (typeName) => roomImages[typeName] || fallbackRoomImage;

export const siteImages = {
  hero: asset('hotel-hero.jpg'),
  login: asset('login-hero.jpg'),
  dining: asset('experience-dining.jpg'),
  spa: asset('experience-spa-v2.jpg'),
  service: asset('experience-service.jpg'),
};
