// Vercel serverless function: /api/flights?flight=LX1741&date=2026-08-22
// Uses AeroDataBox via RapidAPI. Key lives in env var RAPIDAPI_KEY (never in the page).
export default async function handler(req, res) {
  const { flight, date } = req.query || {};
  if (!flight || !date || !/^[A-Z0-9]{3,8}$/i.test(flight) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'bad params' });
  }
  if (!process.env.RAPIDAPI_KEY) {
    return res.status(501).json({ error: 'no key configured' });
  }
  try {
    const r = await fetch(
      `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flight)}/${date}?withAircraftImage=false&withLocation=false`,
      { headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
      } }
    );
    if (!r.ok) return res.status(r.status).json({ error: 'upstream ' + r.status });
    const data = await r.json();
    const f = Array.isArray(data) ? data[0] : (data.flights ? data.flights[0] : data);
    if (!f) return res.status(404).json({ error: 'not found' });
    const pick = (o, k) => (o && o[k]) || null;
    const out = {
      status: f.status || null,
      dep: {
        sched: pick(f.departure?.scheduledTime, 'local'),
        rev: pick(f.departure?.revisedTime, 'local'),
        terminal: f.departure?.terminal || null,
        gate: f.departure?.gate || null
      },
      arr: {
        sched: pick(f.arrival?.scheduledTime, 'local'),
        rev: pick(f.arrival?.revisedTime, 'local'),
        terminal: f.arrival?.terminal || null,
        gate: f.arrival?.gate || null
      }
    };
    // Edge-cache 5 min so repeated opens don't burn quota
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ error: 'fetch failed' });
  }
}
