// Room registry (campus-export). Every closed room of the map already gets its shell (walls, roof, curtain, sign),
// seats, chat and a server plug-in for free; list a client module here only when the room has something special.
// To add one: copy template.js, set its id to a room id from logic.js (PHONG), and add it to this list.
// The server half lives in public/shared/roomplugins.js (REGISTRY). Full guide: README.md ("Adding a room").
import cinema from './cinema.js';
import games from './games.js';
import astrology from './astrology.js';

export const ROOM_MODULES = [
  cinema,     // shared YouTube queue on the big screen
  games,      // Colour Match, Colour Cards, Ludo, Werewolf against computer players
  astrology,  // Numerology, Tử Vi horoscope, Star Chart
];
