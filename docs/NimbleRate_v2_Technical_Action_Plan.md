# NimbleRate v2: Rebuilt Pricing Engine — Technical Action Plan
### From Toy Demo to Real Revenue Intelligence

---

## THE CORE PROBLEM WITH v1

Your current engine multiplies a base rate by weather × events × holidays. That's decorative, not diagnostic. Here's why a hotelier would laugh at it:

- It has **zero awareness of what competitors are charging right now**
- It has **no concept of booking pace** (are rooms filling fast or slow?)
- It treats all events equally (a 500-person art walk ≠ a 40,000-person concert)
- Weather is a modifier at best, not a primary signal
- The occupancy data is simulated from a CSV — not real

A hotel owner already checks Booking.com every morning to see competitor rates. If your tool shows them LESS than what they can see in 10 minutes of manual research, it's dead on arrival.

---

## THE NEW SIGNAL HIERARCHY

Reorder everything. This is how real RMS platforms prioritize:

```
TIER 1 — FOUNDATION (must have, drives 70% of pricing decisions)
├── Compset Rates: what are the 5-10 nearest competing hotels charging RIGHT NOW?
├── Booking Pace: how fast are rooms filling vs. expectations?
└── On-the-Books Occupancy: real current + future occupancy from PMS

TIER 2 — DEMAND INTELLIGENCE (high value, drives 20% of decisions)
├── Events with predicted attendance + ranked impact
├── Holidays + long weekends + bridge days
├── Flight/travel search volume to destination
└── Google Trends interest for destination

TIER 3 — CONTEXT MODIFIERS (supplementary, drives 10% of decisions)
├── Weather forecast (matters for beach/ski, barely for city hotels)
├── Day of week patterns
├── Lead time (how far out is the booking?)
├── Airbnb/STR supply in area
└── University calendars, cruise schedules, convention calendars
```

---

## API SHOPPING LIST — EVERY SOURCE YOU NEED

### TIER 1 APIs

#### 1. COMPETITOR RATE SHOPPING — Makcorps Hotel Price API
**Why this one**: Only affordable rate shopping API accessible to startups. Pulls real-time rates from 200+ OTAs (Booking.com, Expedia, Hotels.com, Agoda, etc.) in a single call. Free trial available.

```
Website:    https://www.makcorps.com
Docs:       https://docs.makcorps.com/hotel-price-apis
Pricing:    Free trial (30 API calls) → Basic $350/mo → Advance $500/mo
Auth:       JWT token (POST /auth with username/password → Bearer token)
RapidAPI:   https://rapidapi.com/manthankool/api/makcorps-hotel-price-comparison

since we will have limited calls, make sure we are not spamming and just sending one request a time. we can also have a countup in settings for how many calls we did
```

**Key Endpoints:**
```
GET /city/{city_name}
  → Returns hotels in a city with prices from top 5 cheapest OTAs
  → Response: hotel name, price per OTA, ratings, reviews

GET /hotel?hotelid={id}&checkin={date}&checkout={date}
  → Returns prices for a specific hotel across all OTAs
  → This is your compset query — run it for each competitor

GET /mapping?city={city}&checkin={date}&checkout={date}
  → Bulk hotel + price data for an entire city
```

**How to use it for compset:**
1. User inputs their hotel location and star rating
2. Query `/city/{city}` to get all hotels in the area
3. Filter by proximity (Haversine), star rating, review score → auto-generate 5-10 compset
4. For each compset hotel, query `/hotel?hotelid=X` daily to get cross-OTA rates
5. Calculate: compset median rate, your hotel's position vs. median, rate parity across OTAs

**This is the single most important API in your entire stack.**

---

#### 2. AMADEUS — Hotel Market Data + Flight Demand (you already have this)
```
Website:    https://developers.amadeus.com/self-service
Base URL:   https://test.api.amadeus.com
Auth:       OAuth2 client_credentials → POST /v1/security/oauth2/token
Your Key:   <AMADEUS_API_KEY>
Your Secret: <AMADEUS_API_SECRET>
Rate Limit: 10 TPS test, ~1000 calls/month free
```

**Use these endpoints (upgraded from v1):**
```
Hotel List by Geocode:
  GET /v1/reference-data/locations/hotels/by-geocode
    ?latitude={lat}&longitude={lon}&radius=5&radiusUnit=KM

Hotel Offers (real competitor pricing):
  GET /v3/shopping/hotel-offers
    ?hotelIds={IDS}&adults=2&checkInDate={date}&checkOutDate={date}
    → Returns: price.total, price.variations.average.base (per night),
      price.variations.changes[] (per-date breakdown), room type, board type

Hotel Sentiment (reputation scoring):
  GET /v2/e-reputation/hotel-sentiments
    ?hotelIds={IDS}
    → Returns 0-100 scores: overallRating, sleepQuality, service,
      valueForMoney, location, internet — USE THIS for compset quality weighting

Flight Demand (NEW — this is your leading indicator):
  GET /v1/analytics/itinerary-price-metrics
    ?originIataCode={origin}&destinationIataCode={dest}&departureDate={date}
    → Returns flight price percentiles — rising prices = rising demand

  GET /v2/shopping/flight-offers
    ?originLocationCode={code}&destinationLocationCode={code}
    → Use offer count as proxy for flight search volume
```

**Amadeus Flight data is your earliest demand signal** — flight searches happen 145 days before hotel bookings. If flight prices to Austin are spiking for March, hotel demand will follow.

---

#### 3. ON-THE-BOOKS / BOOKING PACE — Simulated for Hackathon, PMS Integration for Production

For the hackathon, you must simulate this convincingly:

```javascript
// Generate realistic OTB data for a 40-room hotel, 90 days forward
function generateOTBData(totalRooms, daysForward) {
  const otb = [];
  for (let d = 0; d < daysForward; d++) {
    const date = addDays(new Date(), d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    // Base booking curve: more rooms booked for nearer dates
    const leadTimeFactor = Math.max(0, 1 - (d / daysForward) * 0.8);
    const weekendBoost = isWeekend ? 0.15 : 0;
    const noise = (Math.random() - 0.5) * 0.1;
    const occupancyRate = Math.min(0.98, Math.max(0.05,
      leadTimeFactor * 0.7 + weekendBoost + noise
    ));
    const roomsBooked = Math.round(totalRooms * occupancyRate);

    otb.push({
      date: format(date, 'yyyy-MM-dd'),
      roomsBooked,
      roomsAvailable: totalRooms - roomsBooked,
      occupancyRate: Math.round(occupancyRate * 100),
      // Simulate booking pace: rooms picked up in last 7 days
      pickupLast7Days: Math.max(0, Math.round(
        roomsBooked * 0.15 * (1 + Math.random() * 0.5)
      )),
      // Same date last year (simulated)
      occupancyLastYear: Math.round(
        (occupancyRate + (Math.random() - 0.5) * 0.15) * 100
      ),
    });
  }
  return otb;
}
```

**For production**, integrate with PMS APIs:
- **Cloudbeds**: Open REST API, 50+ endpoints, `GET /reservations` for OTB data
- **Mews**: `GET /api/connector/v1/reservations/getAll` — most developer-friendly
- **Little Hotelier**: Via SiteMinder API — targets small properties

---

### TIER 2 APIs

#### 4. PREDICTHQ — Event Intelligence (replaces Ticketmaster)
**Why switch**: PredictHQ covers 20M+ events across 19 categories in 25,000+ cities. Unlike Ticketmaster, it provides **predicted attendance**, **impact ranking (PHQ Rank 0-100)**, and **predicted event spend**. Duetto, Wyndham, and Booking.com all use it. It solves your venue capacity problem entirely.

```
Website:    https://www.predicthq.com
Docs:       https://docs.predicthq.com
Pricing:    14-day free trial (full API access, no credit card)
Auth:       OAuth2 Bearer token
Base URL:   https://api.predicthq.com/v1

since we will have limited calls, make sure we are not spamming and just sending one request a time. we can also have a countup in settings for how many calls we did
```

**Key Endpoints:**
```
GET /v1/events/
  ?location_around.origin={lat},{lon}
  &location_around.offset=5km
  &start.gte={date}
  &start.lte={date}
  &category=concerts,conferences,sports,festivals,community
  &rank.gte=50              ← only events with meaningful impact
  &sort=rank                ← highest impact first

Response includes:
  - title, category, start/end
  - rank (0-100 PHQ Rank — THIS is what Ticketmaster can't give you)
  - predicted_event_spend (dollar amount!)
  - entities[].name (venue), entities[].formatted_address
  - geo.geometry (exact location for distance calc)
  - labels[] (indoor, outdoor, etc.)
  - phq_attendance (PREDICTED attendance — solves your #1 problem)

GET /v1/features/
  ?location_around.origin={lat},{lon}
  &location_around.offset=5km
  &phq_attendance_concerts.stats=sum
  &phq_attendance_sports.stats=sum
  → Pre-aggregated demand features ready for your model
```

**Why this is 10x better than Ticketmaster for your use case:**
- Ticketmaster: no attendance, no impact ranking, no non-ticketed events
- PredictHQ: predicted attendance, PHQ rank 0-100, covers conferences/festivals/school events, pre-built ML features, 5 years of historical data

---

#### 5. NAGER.AT — Holidays + Long Weekends (keep this, it's great)
```
Website:    https://date.nager.at
Docs:       https://date.nager.at/swagger/index.html
Pricing:    100% free, no auth, no rate limits, CORS enabled
```

**Endpoints (use ALL of these):**
```
GET /api/v3/PublicHolidays/{Year}/{CountryCode}
  → date, name, localName, types[], counties[], global

GET /api/v3/LongWeekend/{Year}/{CountryCode}
  → startDate, endDate, dayCount, needBridgeDay  ← HIGH VALUE

GET /api/v3/NextPublicHolidays/{CountryCode}
  → Next 365 days of holidays

GET /api/v3/IsTodayPublicHoliday/{CountryCode}
  → Returns 200 (yes) or 204 (no)
```

---

#### 6. GOOGLE TRENDS — Destination Search Interest (free demand signal)
**Why**: Academically validated — search interest for a destination correlates with hotel demand 30-60 days later. Post-COVID, Google Trends improved forecast accuracy in 77% of scenarios.

```

SerpApi Google Trends API (more reliable, $75/mo):
  Website: https://serpapi.com
  GET https://serpapi.com/search.json
    ?engine=google_trends
    &q=hotels+Austin+Texas
    &date=today+3-m
    &geo=US
    &api_key={key}
  # Returns JSON with interest_over_time data points

since we will have limited calls, make sure we are not spamming and just sending one request a time. we can also have a countup in settings for how many calls we did
```

**Implementation**: Query weekly for `"hotels {city_name}"` and `"{city_name} travel"`. Compare current week's index to 4-week rolling average. If trending >20% above average → demand surge signal (multiplier 1.05-1.15).

---

#### 7. SOJERN — Flight + Travel Intent Data (free public dashboard)
```
Website:    https://www.sojern.com/travel-insights
Pricing:    Public dashboard free (updated weekly on Mondays)
```
Sojern's public travel insights dashboard shows flight search volume and booking volume by destination, segmented by origin market. Not API-accessible for free, but their dashboard data can inform your demo narrative. For production, their paid platform provides API-level travel intent data.

---

### TIER 3 APIs

#### 8. OPENWEATHERMAP — Weather Forecast (you already have this)
```
Website:    https://openweathermap.org/api
Your Key:   <OPENWEATHER_API_KEY>
Pricing:    Free: 60 calls/min, 1M calls/month
```

**Downgrade its importance in v2.** Weather is a Tier 3 modifier:
```
5-Day Forecast:
  GET https://api.openweathermap.org/data/2.5/forecast
    ?lat={lat}&lon={lon}&appid={key}&units=metric

Map condition codes to simple categories:
  800         → 'clear'    → beach: 1.10x, city: 1.00x
  801-804     → 'cloudy'   → beach: 0.95x, city: 1.00x
  500-531     → 'rain'     → beach: 0.85x, city: 0.98x
  200-232     → 'storm'    → beach: 0.75x, city: 0.95x
  600-622     → 'snow'     → ski: 1.20x,  city: 0.95x
```

---

#### 9. AIRDNA / STR ALTERNATIVE SUPPLY — Airbnb Competition
For tracking whether Airbnb listings are absorbing your demand:

```
we will go Manual:
  Scrape Airbnb listings count + average price for your demo city
  Hardcode as a data point
```

---

#### 10. UNIVERSITY CALENDARS — Niche but massive impact
```
Source: Publicly available academic calendars
  Example: https://registrar.utexas.edu/calendars/
  Data: graduation dates, move-in, parents' weekend, homecoming

Implementation:
  Hardcode 5-10 major university events for your demo city
  Each event type gets a multiplier:
    Graduation: 1.30-1.50x (parents book months ahead)
    Move-in weekend: 1.20-1.35x
    Parents' weekend: 1.25-1.40x
    Homecoming: 1.15-1.25x
```

---

#### 11. CRUISEMAPPER — Cruise Ship Port Schedules (free)
```
Website:    https://www.cruisemapper.com
Data:       Published 1-2 years ahead, organized by port
  Example:  /ports/vancouver-port-4

Implementation:
  For coastal demo cities, scrape upcoming port calls
  Each cruise call: ~3,000 passengers needing hotels pre/post voyage
  Multiplier: 1.10-1.20x on arrival/departure days
```

---

## THE NEW PRICING ALGORITHM

### Architecture: Weighted Multiplicative with Compset Anchoring

The fundamental change: **start from the market, not from a base rate.**

```javascript
// =====================================================
// NimbleRate v2 Pricing Engine
// =====================================================

function calculateRecommendedRate({
  hotelConfig,          // base rate, star rating, room types, min/max prices
  compsetRates,         // array of competitor rates from Makcorps
  bookingPace,          // OTB data: current occupancy, pickup, YoY comparison
  events,               // PredictHQ events with PHQ rank + predicted attendance
  holidays,             // Nager.at holidays + long weekends
  weather,              // OpenWeatherMap forecast
  searchTrends,         // Google Trends index
  flightDemand,         // Amadeus flight price metrics
  targetDate,           // the date we're pricing for
  hotelType,            // 'city_business' | 'beach_leisure' | 'ski_resort' | 'airport'
}) {

  // =========================================================
  // STEP 1: MARKET ANCHOR — Position relative to compset
  // =========================================================
  // Instead of starting with a base rate and multiplying,
  // start with WHERE YOU SHOULD BE relative to competitors.

  const compsetMedian = calculateMedian(compsetRates.map(r => r.rate));
  const compsetP25 = calculatePercentile(compsetRates.map(r => r.rate), 25);
  const compsetP75 = calculatePercentile(compsetRates.map(r => r.rate), 75);

  // Hotel's target position in market (configurable by owner)
  // 0.0 = cheapest in market, 0.5 = median, 1.0 = most expensive
  const marketPosition = hotelConfig.targetMarketPosition || 0.5;

  // Calculate anchor rate based on market position
  const anchorRate = compsetP25 + (compsetP75 - compsetP25) * marketPosition;

  // =========================================================
  // STEP 2: DEMAND MULTIPLIERS — Adjust anchor based on signals
  // =========================================================

  // --- 2a. Booking Pace Multiplier (most predictive internal signal) ---
  const paceMultiplier = calculatePaceMultiplier(bookingPace, targetDate);
  // Logic:
  //   occupancy > 85% AND pace ahead of last year → 1.25-1.50x
  //   occupancy 70-85% AND pace on track           → 1.10-1.20x
  //   occupancy 50-70% AND pace on track           → 1.00x (baseline)
  //   occupancy 30-50% AND pace behind              → 0.85-0.95x
  //   occupancy < 30% AND pace behind               → 0.75-0.85x
  //   Lead time < 3 days AND rooms available < 5    → 1.30-1.60x (last minute scarcity)

  // --- 2b. Event Multiplier (use PredictHQ PHQ rank + attendance) ---
  const eventMultiplier = calculateEventMultiplier(events, hotelConfig.location);
  // Logic:
  //   Sum predicted attendance of all events on targetDate within radius
  //   Weight by PHQ rank (0-100) and distance decay
  //   PHQ rank 90-100, attendance > 30,000, < 2mi  → 1.40-2.00x
  //   PHQ rank 70-89,  attendance 10,000-30,000     → 1.20-1.40x
  //   PHQ rank 50-69,  attendance 5,000-10,000      → 1.10-1.20x
  //   PHQ rank < 50 or attendance < 5,000           → 1.00-1.05x
  //   Multiple events stacking on same date         → compound with dampening

  // --- 2c. Holiday Multiplier ---
  const holidayMultiplier = calculateHolidayMultiplier(holidays, targetDate);
  // Logic:
  //   Long weekend (3+ days)           → 1.25-1.40x
  //   National public holiday          → 1.15-1.30x
  //   Bridge day opportunity           → 1.10-1.20x
  //   Day after major holiday (lull)   → 0.80-0.90x
  //   School break period              → 1.10-1.25x (leisure hotels only)

  // --- 2d. Forward-Looking Demand Multiplier ---
  const demandMultiplier = calculateDemandMultiplier(searchTrends, flightDemand);
  // Logic:
  //   Google Trends index > 120% of 4-week avg → demand surge → 1.05-1.15x
  //   Flight prices to destination rising >15%  → inbound demand → 1.05-1.10x
  //   Both signals positive simultaneously      → 1.10-1.20x
  //   Both signals negative                     → 0.90-0.95x

  // --- 2e. Weather Multiplier (context-dependent) ---
  const weatherMultiplier = calculateWeatherMultiplier(weather, targetDate, hotelType);
  // Applied with hotel-type weighting:
  //   Beach/leisure hotels: weather weight = 0.8 (matters a lot)
  //   Ski resorts: weather weight = 0.7 (snow matters)
  //   City/business hotels: weather weight = 0.1 (barely matters)
  //   Airport hotels: weather weight = 0.05 (irrelevant)

  // --- 2f. Day of Week Multiplier ---
  const dowMultiplier = calculateDayOfWeekMultiplier(targetDate, hotelType);
  // City/business: Tue-Wed peak (1.10x), Sat-Sun trough (0.85x)
  // Leisure: Fri-Sat peak (1.15-1.20x), Mon-Tue trough (0.85x)

  // --- 2g. Lead Time Multiplier ---
  const daysOut = differenceInDays(targetDate, new Date());
  const leadTimeMultiplier = calculateLeadTimeMultiplier(daysOut, bookingPace);
  // Logic:
  //   < 1 day out, rooms available  → last-minute discount 0.85x
  //   < 1 day out, < 3 rooms left   → last-minute premium 1.40x
  //   1-3 days, rooms available      → slight discount 0.95x
  //   7-14 days                      → baseline 1.00x
  //   30-60 days, high pace          → early bird premium 1.05x
  //   90+ days                       → baseline 1.00x

  // =========================================================
  // STEP 3: COMPOUND WITH DAMPENING
  // =========================================================

  const rawMultiplier =
    paceMultiplier *
    eventMultiplier *
    holidayMultiplier *
    demandMultiplier *
    weatherMultiplier *
    dowMultiplier *
    leadTimeMultiplier;

  // Logarithmic dampening above 2.0x
  let finalMultiplier;
  if (rawMultiplier > 2.0) {
    finalMultiplier = 2.0 + Math.log2(rawMultiplier / 2.0) * 0.5;
  } else if (rawMultiplier < 0.7) {
    // Floor dampening: don't drop below 70% of anchor without good reason
    finalMultiplier = 0.7 + (rawMultiplier - 0.7) * 0.5;
  } else {
    finalMultiplier = rawMultiplier;
  }

  // =========================================================
  // STEP 4: APPLY GUARDRAILS
  // =========================================================

  let recommendedRate = Math.round(anchorRate * finalMultiplier);

  // Owner-defined guardrails
  recommendedRate = Math.max(recommendedRate, hotelConfig.minPrice);
  recommendedRate = Math.min(recommendedRate, hotelConfig.maxPrice);

  // Rate change limit: max ±20% from yesterday's rate
  if (hotelConfig.yesterdayRate) {
    const maxChange = hotelConfig.yesterdayRate * 0.20;
    recommendedRate = Math.max(
      recommendedRate,
      hotelConfig.yesterdayRate - maxChange
    );
    recommendedRate = Math.min(
      recommendedRate,
      hotelConfig.yesterdayRate + maxChange
    );
  }

  // =========================================================
  // STEP 5: BUILD EXPLAINABILITY OBJECT
  // =========================================================

  return {
    date: targetDate,
    recommendedRate,
    anchorRate,
    compsetMedian,
    finalMultiplier: Math.round(finalMultiplier * 100) / 100,
    breakdown: {
      pace:     { value: paceMultiplier,     weight: 'high',   reason: describePace(bookingPace) },
      events:   { value: eventMultiplier,    weight: 'high',   reason: describeEvents(events) },
      holidays: { value: holidayMultiplier,  weight: 'medium', reason: describeHolidays(holidays) },
      demand:   { value: demandMultiplier,   weight: 'medium', reason: describeDemand(searchTrends) },
      weather:  { value: weatherMultiplier,  weight: 'low',    reason: describeWeather(weather) },
      dayOfWeek:{ value: dowMultiplier,      weight: 'medium', reason: describeDOW(targetDate) },
      leadTime: { value: leadTimeMultiplier, weight: 'medium', reason: describeLeadTime(daysOut) },
    },
    compset: compsetRates.map(c => ({
      name: c.hotelName,
      rate: c.rate,
      source: c.ota,
      deltaVsRecommended: recommendedRate - c.rate,
    })),
    guardrails: {
      minPrice: hotelConfig.minPrice,
      maxPrice: hotelConfig.maxPrice,
      rateChangeCapped: false, // flag if rate was capped by ±20% rule
    },
    confidence: calculateConfidence(compsetRates.length, bookingPace),
    // 'high' if 5+ compset rates + real pace data
    // 'medium' if 3-4 compset rates
    // 'low' if simulated data
  };
}
```

---

## IMPLEMENTATION PHASES

### PHASE 1: Hackathon MVP (build this weekend)

**Priority order:**

```
1. Makcorps integration → compset rates (THE differentiator)
2. PredictHQ integration → events with attendance + ranking
3. Nager.at holidays + long weekends (already working, enhance)
4. Simulated booking pace data (realistic mock)
5. Amadeus hotel offers (market pricing reference)
6. OpenWeatherMap (downgrade to Tier 3 modifier)
7. New pricing engine (compset-anchored, not base-rate multiplied)
8. Explainability panel in UI (show WHY for every price)
```

**Demo setup:**
- Hardcode to **Austin, Texas** (SXSW, ACL Fest, UT Austin graduation)
- 40-room boutique hotel, 3.5 stars
- Auto-detect 8 competitors via Makcorps within 3 miles
- 30-day forward calendar with daily recommended rates
- Show compset positioning chart: your hotel's rate vs. competitor range
- Click any date → full multiplier breakdown with natural language explanation

**What to say to judges:**
> "v1 of our engine used weather and events as multipliers on a base rate. We realized that's backwards. Real hotel pricing starts with the market — what are your competitors charging? — then adjusts based on demand signals. So we rebuilt the engine around compset anchoring. We pull real-time rates from 200+ OTAs for competing hotels, position our client within that competitive set, then layer demand signals from event intelligence, booking pace, holidays, and search trends. Every recommendation comes with a full breakdown — the owner sees exactly why we're recommending $189 tonight instead of $149."

---

### PHASE 2: Post-Hackathon (weeks 1-4)

```
1. Google Trends integration (pytrends for destination search volume)
2. Amadeus flight demand API (forward-looking travel intent)
3. Replace simulated OTB with actual PMS integration (Cloudbeds API first)
4. Historical rate tracking (store daily compset rates for trend analysis)
5. Rate parity monitoring (alert if OTAs are undercutting direct rates)
6. University calendar integration for college-town hotels
```

### PHASE 3: Product-Market Fit (months 1-3)

```
1. Rate pushing via channel manager integration (SiteMinder or Cloudbeds)
   → This is the #1 feature that converts free users to paying customers
2. AirDNA / Mashvisor for Airbnb supply monitoring
3. Multi-property support
4. Automated compset detection using ML clustering
5. Booking pace anomaly detection (alert when pace deviates from forecast)
6. Revenue analytics dashboard (ADR, RevPAR, occupancy trends)
```

---

## DATA FLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│                   USER INPUT                         │
│  Hotel location, star rating, base price, min/max    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              PARALLEL DATA FETCH                      │
│  (Promise.allSettled — graceful degradation)          │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Makcorps │  │PredictHQ │  │ Nager.at │           │
│  │ Compset  │  │ Events   │  │ Holidays │           │
│  │ Rates    │  │ w/ PHQ   │  │ + Long   │           │
│  │ 200+ OTA │  │ rank +   │  │ Weekends │           │
│  │          │  │ attend.  │  │          │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │              │                 │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐           │
│  │ Amadeus  │  │ Weather  │  │ Google   │           │
│  │ Offers + │  │ 5-day    │  │ Trends   │           │
│  │ Flights  │  │ Forecast │  │ Interest │           │
│  └────┬─────┘  └────┴─────┘  └────┴─────┘           │
│       │              │              │                 │
└───────┼──────────────┼──────────────┼────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────────────────────────────────────────────┐
│              DATA NORMALIZATION LAYER                  │
│                                                       │
│  • Compset rates → median, P25, P75, position score  │
│  • Events → attendance-weighted impact per date       │
│  • Holidays → binary flags + long weekend detection   │
│  • Weather → category code → hotel-type multiplier   │
│  • Trends → 4-week rolling average comparison        │
│  • Flight demand → price change % as demand proxy    │
│  • OTB → occupancy %, pace vs. LY, pickup velocity   │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              PRICING ENGINE                           │
│                                                       │
│  1. Anchor rate from compset positioning             │
│  2. Apply multiplicative demand adjustments          │
│  3. Logarithmic dampening above 2.0x                 │
│  4. Owner guardrails (min/max, rate change limits)   │
│  5. Generate explainability breakdown                │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              OUTPUT TO UI                             │
│                                                       │
│  For each of 30-90 forward dates:                    │
│  • Recommended rate with confidence level            │
│  • Compset comparison chart                          │
│  • Multiplier breakdown (natural language)           │
│  • Events/holidays/weather icons on calendar         │
│  • Revenue impact estimate vs. static pricing        │
└──────────────────────────────────────────────────────┘
```

---

## ENV VARIABLES (.env.local)

```bash
# Amadeus (you have these)
VITE_AMADEUS_API_KEY=<AMADEUS_API_KEY>
VITE_AMADEUS_API_SECRET=<AMADEUS_API_SECRET>
VITE_AMADEUS_BASE_URL=https://test.api.amadeus.com

# Ticketmaster (REPLACE with PredictHQ for v2)
VITE_TICKETMASTER_KEY=<TICKETMASTER_CONSUMER_KEY>

# PredictHQ (sign up for 14-day trial)
VITE_PREDICTHQ_TOKEN=                    # ← get from predicthq.com/signup

# Makcorps (sign up for free trial - 30 calls)
VITE_MAKCORPS_USERNAME=                  # ← get from makcorps.com
VITE_MAKCORPS_PASSWORD=                  # ← get from makcorps.com

# OpenWeatherMap (you have this)
VITE_OPENWEATHER_KEY=<OPENWEATHER_API_KEY>

# Nager.at — no key needed

# SerpApi for Google Trends (optional, $75/mo)
VITE_SERPAPI_KEY=                         # ← get from serpapi.com (optional)

# Demo config
VITE_DEMO_CITY=Austin
VITE_DEMO_LAT=30.2672
VITE_DEMO_LON=-97.7431
VITE_DEMO_COUNTRY=US
VITE_DEMO_IATA=AUS
```

---

## SIGN-UP CHECKLIST

| API | URL | Action | Time | Cost |
|---|---|---|---|---|
| Makcorps | makcorps.com | Sign up, get JWT credentials | 5 min | Free (30 calls) |
| PredictHQ | predicthq.com/signup | 14-day trial, get OAuth token | 5 min | Free (14 days) |
| SerpApi | serpapi.com | Sign up for Google Trends API | 5 min | Free (100 searches/mo) |
| Mashvisor | mashvisor.com | Airbnb analytics (optional) | 5 min | Free tier |
| AirDNA | airdna.co | STR market data (optional) | 5 min | $20-40/mo |

You already have: Amadeus, Ticketmaster (keep as fallback), OpenWeatherMap, Nager.at.

---

## WHAT THIS GIVES YOU THAT NO BUDGET RMS HAS

The thing that will make judges — and eventually customers — take notice:

1. **Compset-anchored pricing** from real OTA data (not guessing from a base rate)
2. **Event intelligence with predicted attendance** (not just "there's an event nearby")
3. **Multi-signal demand fusion**: flight intent + search trends + events + holidays + pace — no affordable tool combines all of these for independent hotels
4. **Full explainability**: every price recommendation comes with a plain-language breakdown
5. **Bridge day detection**: Nager.at's needBridgeDay flag is data that even IDeaS doesn't surface cleanly
6. **Confidence scoring**: the system tells you how sure it is, based on data completeness

That's not a hackathon demo. That's the foundation of a real product.
