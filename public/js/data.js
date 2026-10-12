// DEMO DATA ONLY. These made-up homes are never shown to visitors. They are loaded on demand by store.js (loadDemoSeed)
// for the owner's demo mode (Admin > Add demo listings) and for tests. Real listings come from Firestore.
const agent = (id, name) => ({ id, name, avatar: `img/av-${id}.webp`, photo: id === "daniel" ? "img/agent-daniel.webp" : `img/av-${id}.webp` });
const daniel = agent("daniel", "Daniel Okafor"), ngozi = agent("ngozi", "Ngozi Adeyemi"),
  tunde = agent("tunde", "Tunde Salami"), amara = agent("amara", "Amara Bello"), ibrahim = agent("ibrahim", "Ibrahim Musa");
const base = { city: "Lagos", status: "active", service: 300000, deposit: 300000 };

export const SEED = [
  { ...base, id: "palm-court", title: "Palm Court Apartment", area: "Lekki Phase 1", type: "Apartment", price: 3600000, service: 350000, deposit: 200000, beds: 2, baths: 2, sqm: 120, lat: 6.4474, lng: 3.4723, agent: daniel,
    thumb: "img/home-palm.webp", images: ["img/palm-living.webp", "img/palm-kitchen.webp", "img/palm-bedroom.webp", "img/palm-court.webp"],
    amenities: ["Parking", "Water supply", "Security", "Balcony"],
    desc: "A stylish 2-bedroom apartment in the heart of Lekki Phase 1, offering modern finishes, spacious living areas and excellent natural light. Located in a secure, well-maintained development with easy access to top schools, restaurants and retail hubs." },
  { ...base, id: "maple-terrace", thumb: "img/home-maple.webp", title: "Maple Terrace", area: "Ajah", type: "House", service: 250000, deposit: 250000, price: 2400000, beds: 3, baths: 3, sqm: 165, lat: 6.4698, lng: 3.5852, agent: ngozi,
    images: ["img/maple-terrace.webp", "img/apartment-3bed.webp"], amenities: ["Parking", "Security", "Generator", "Water supply"],
    desc: "A contemporary 3-bedroom terrace in a gated estate in Ajah, with a private driveway, spacious reception and a quiet, family-friendly neighbourhood." },
  { ...base, id: "oakview-studio", thumb: "img/home-oak.webp", title: "Oakview Studio", area: "Yaba", type: "Studio", price: 1200000, beds: 0, baths: 1, sqm: 45, lat: 6.5095, lng: 3.3711, agent: tunde, service: 150000, deposit: 150000,
    images: ["img/oakview-studio.webp"], amenities: ["Water supply", "Security", "Wi-Fi"],
    desc: "A bright, well-finished studio close to the Yaba tech cluster, with floor-to-ceiling windows and a city view. Ideal for a young professional." },
  { ...base, id: "duplex-4bed", title: "4 Bedroom Duplex", area: "Lekki Phase 1", type: "House", price: 3600000, beds: 4, baths: 4, sqm: 280, lat: 6.4531, lng: 3.4741, agent: amara,
    images: ["img/duplex-4bed.webp"], amenities: ["Parking", "Security", "Generator", "Garden"],
    desc: "A modern 4-bedroom duplex with a landscaped garden, glass balcony and boys' quarters, in a secure part of Lekki Phase 1." },
  { ...base, id: "apartment-3bed", title: "3 Bedroom Apartment", area: "Ikate, Lekki", type: "Apartment", price: 2400000, beds: 3, baths: 3, sqm: 150, lat: 6.4408, lng: 3.4856, agent: ibrahim,
    images: ["img/apartment-3bed.webp"], amenities: ["Parking", "Water supply", "Security", "Gym"],
    desc: "A beautifully finished 3-bedroom apartment in Ikate with an open-plan living and dining area and a fitted kitchen." },
  { ...base, id: "apartment-2bed", title: "2 Bedroom Apartment", area: "Victoria Island", type: "Apartment", price: 1800000, beds: 2, baths: 2, sqm: 105, lat: 6.4281, lng: 3.4219, agent: daniel,
    images: ["img/apartment-2bed.webp"], amenities: ["Parking", "Security", "Balcony"],
    desc: "A well-kept 2-bedroom apartment a short walk from Victoria Island's offices, restaurants and the waterfront." },
  { ...base, id: "detached-5bed", title: "5 Bedroom Detached House", area: "Lekki", type: "House", price: 4800000, beds: 5, baths: 5, sqm: 420, lat: 6.4549, lng: 3.5233, agent: ngozi,
    images: ["img/detached-5bed.webp"], amenities: ["Parking", "Security", "Generator", "Garden", "Pool"],
    desc: "A luxurious detached house with a covered patio, private compound and space for the whole family, in a gated Lekki estate." },
  { ...base, id: "harbour-view", title: "Harbour View Apartments", area: "Victoria Island", type: "Apartment", price: 5500000, beds: 3, baths: 3, sqm: 190, lat: 6.4281, lng: 3.4219, agent: daniel, service: 500000, deposit: 500000, available: false,
    images: ["img/detached-5bed.webp"], amenities: ["Parking", "Security", "Generator", "Balcony"],
    desc: "A modern waterfront apartment block in Victoria Island with glass balconies and secure parking. Currently unavailable." }
];
export const DEMO_SEED = SEED;
