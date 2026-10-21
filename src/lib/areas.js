// Areas buyers and sellers can choose. The coordinates are the centre of each area.
// The backend replaces this list, and sellers will place an exact pin on a map.
export const AREAS = [
  { id: "cbd", name: "Nairobi CBD", town: "Nairobi", lat: -1.2864, lng: 36.8172 },
  { id: "westlands", name: "Westlands", town: "Nairobi", lat: -1.2676, lng: 36.8108 },
  { id: "kilimani", name: "Kilimani", town: "Nairobi", lat: -1.2906, lng: 36.7869 },
  { id: "karen", name: "Karen", town: "Nairobi", lat: -1.319, lng: 36.7106 },
  { id: "eastleigh", name: "Eastleigh", town: "Nairobi", lat: -1.2744, lng: 36.8503 },
  { id: "kasarani", name: "Kasarani", town: "Nairobi", lat: -1.2216, lng: 36.8963 },
  { id: "ruaka", name: "Ruaka", town: "Nairobi", lat: -1.2, lng: 36.77 },
  { id: "embakasi", name: "Embakasi", town: "Nairobi", lat: -1.32, lng: 36.9 },
  { id: "rongai", name: "Rongai", town: "Nairobi", lat: -1.396, lng: 36.764 },
  { id: "nyali", name: "Nyali", town: "Mombasa", lat: -4.02, lng: 39.7173 },
  { id: "mombasa-island", name: "Mombasa Island", town: "Mombasa", lat: -4.0435, lng: 39.6682 },
  { id: "milimani", name: "Milimani", town: "Kisumu", lat: -0.1022, lng: 34.7617 },
  { id: "kisumu-cbd", name: "Kisumu CBD", town: "Kisumu", lat: -0.0917, lng: 34.768 },
];
 
export const TOWNS = [...new Set(AREAS.map((a) => a.town))];
 
export const findArea = (id) => AREAS.find((a) => a.id === id);