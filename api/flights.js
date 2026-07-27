// Vercel serverless function: /api/flights?flight=UA8932,LH2500&date=2026-08-17
// Accepts a COMMA-SEPARATED candidate list — tries each in order and returns the
// first that resolves. This handles codeshares: marketing number first, operating
// carrier number as fallback.
// Key lives in env var RAPIDAPI_KEY and is never exposed to the browser.
export default async function handler(req, res) {
  const { flight, date } = req.query || {};
  if (!flight || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'bad params' });
  }
  const candidates = String(flight).split(',').map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z0-9]{3,8}$/.test(s)).slice(0, 4);
  if (!candidates.length) return res.status(400).json({ error: 'bad flight' });
  if (!process.env.RAPIDAPI_KEY) return res.status(501).json({ error: 'no key configured' });

  const pick = (o, k) => (o && o[k]) || null;

  for (const num of candidates) {
    try {
      const r = await fetch(
        `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(num)}/${date}?withAircraftImage=false&withLocation=false`,
        { headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
        } }
      );
      if (r.status === 404) continue;              // try next candidate
      if (r.status === 429) return res.status(429).json({ error: 'quota' });
      if (!r.ok) continue;
      const data = await r.json();
      const f = Array.isArray(data) ? data[0] : (data.flights ? data.flights[0] : data);
      if (!f) continue;
      const out = {
        resolved: num,
        status: f.status || null,
        aircraft: f.aircraft?.model || null,
        dep: {
          airport: f.departure?.airport?.iata || null,
          sched: pick(f.departure?.scheduledTime, 'local'),
          rev: pick(f.departure?.revisedTime, 'local'),
          terminal: f.departure?.terminal || null,
          gate: f.departure?.gate || null,
          checkIn: f.departure?.checkInDesk || null,
          belt: null
        },
        arr: {
          airport: f.arrival?.airport?.iata || null,
          sched: pick(f.arrival?.scheduledTime, 'local'),
          rev: pick(f.arrival?.revisedTime, 'local'),
          terminal: f.arrival?.terminal || null,
          gate: f.arrival?.gate || null,
          belt: f.arrival?.baggageBelt || null
        }
      };
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
      return res.status(200).json(out);
    } catch (e) { /* try next candidate */ }
  }
  res.setHeader('Cache-Control', 's-maxage=600');
  return res.status(404).json({ error: 'not tracked', tried: candidates });
}
