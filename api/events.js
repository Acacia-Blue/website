// Vercel serverless function: GET /api/events
//
// Fetches Acacia Blue's upcoming public events from the Humanitix Public API and
// returns a trimmed list for the website's Events page. The Humanitix key stays
// on the server; the browser only ever sees the event details below.
//
// Setup (Vercel dashboard > Project > Settings > Environment Variables):
//   HUMANITIX_API_KEY  An hx_live_... key with read access to events.
//                      Create it on the API keys page of the Humanitix console.
//
// Without a key, preview and local runs return sample events (flagged demo: true)
// so the page can be designed and checked. Production returns an empty list.
//
// Responses are cached at Vercel's edge for 10 minutes, so Humanitix is called a
// handful of times an hour at most, however many people view the page.

const HUMANITIX_URL = 'https://api.humanitix.com/v1/events';
const MAX_PAGES = 5; // 100 events per page; far more than we expect to run

module.exports = async function handler(req, res) {
  const apiKey = process.env.HUMANITIX_API_KEY;

  if (!apiKey) {
    const isProduction = process.env.VERCEL_ENV === 'production';
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      events: isProduction ? [] : sampleEvents(),
      demo: !isProduction,
    });
  }

  // TEMPORARY diagnostic, previews only. Remove before merging.
  if (req.query && req.query.debug === '1' && process.env.VERCEL_ENV !== 'production') {
    res.setHeader('Cache-Control', 'no-store');
    const out = {};
    for (const future of [true, false]) {
      try {
        const r = await fetch(`${HUMANITIX_URL}?page=1&pageSize=100${future ? '&inFutureOnly=true' : ''}`, {
          headers: { 'x-api-key': apiKey, accept: 'application/json' },
        });
        const body = await r.json();
        out[future ? 'inFutureOnly' : 'all'] = {
          status: r.status,
          total: body.total,
          error: body.code || body.message || undefined,
          events: (body.events || []).map((e) => ({
            name: e.name, published: e.published, public: e.public, isArchived: e.isArchived,
            startDate: e.startDate, endDate: e.endDate, location: e.location,
            dates: (e.dates || []).map((d) => ({ start: d.startDate, end: d.endDate, deleted: d.deleted, disabled: d.disabled })),
          })),
        };
      } catch (err) {
        out[future ? 'inFutureOnly' : 'all'] = { fetchError: err.message };
      }
    }
    return res.status(200).json(out);
  }

  try {
    const raw = await fetchAllUpcoming(apiKey);
    const now = Date.now();
    const events = raw
      .filter((e) => e.published && e.public && !e.isArchived)
      .map((e) => toListing(e, now))
      .filter(Boolean)
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({ events });
  } catch (err) {
    console.error('Humanitix fetch failed:', err.message);
    // Short cache so a Humanitix outage doesn't hammer the API, but recovers fast.
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(502).json({ events: [], error: 'Events are unavailable right now.' });
  }
};

async function fetchAllUpcoming(apiKey) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${HUMANITIX_URL}?page=${page}&pageSize=100&inFutureOnly=true`;
    const r = await fetch(url, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Humanitix responded ${r.status}`);
    const body = await r.json();
    const batch = body.events || [];
    all.push(...batch);
    if (all.length >= (body.total || 0) || batch.length === 0) break;
  }
  return all;
}

// Turn a Humanitix event into the small shape the page needs.
// Recurring events show their next upcoming date, plus a count of later dates.
function toListing(e, now) {
  const upcoming = (e.dates && e.dates.length ? e.dates : [{ startDate: e.startDate, endDate: e.endDate }])
    .filter((d) => !d.deleted && !d.disabled && new Date(d.endDate).getTime() > now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  if (!upcoming.length) return null;

  const next = upcoming[0];
  const loc = e.eventLocation || {};
  const image = (e.featureImage && e.featureImage.url) || (e.bannerImage && e.bannerImage.url) || null;

  return {
    id: e._id,
    name: e.name,
    summary: plainText(e.sharingDescription || e.description || '').slice(0, 280),
    url: e.url,
    image,
    start: next.startDate,
    end: next.endDate,
    timezone: e.timezone,
    moreDates: upcoming.length - 1,
    location: {
      type: loc.type || 'toBeAnnounced',
      venue: loc.venueName || '',
      address: loc.address || '',
      city: loc.city || '',
    },
    price: e.pricing ? { min: e.pricing.minimumPrice, max: e.pricing.maximumPrice, currency: e.currency } : null,
    soldOut: Boolean(e.markedAsSoldOut),
    salesPaused: Boolean(e.suspendSales),
  };
}

function plainText(html) {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function sampleEvents() {
  const day = 24 * 60 * 60 * 1000;
  const at = (days, hour) => {
    const d = new Date(Date.now() + days * day);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  return [
    {
      id: 'sample-1',
      name: 'Campaign finance basics for NSW independents',
      summary: 'Disclosure thresholds, donation caps and record keeping for the 2027 NSW state election, in plain language.',
      url: 'https://events.humanitix.com/',
      image: null,
      start: at(9, 7), end: at(9, 8),
      timezone: 'Australia/Sydney', moreDates: 0,
      location: { type: 'online', venue: '', address: '', city: '' },
      price: { min: 0, max: 0, currency: 'AUD' },
      soldOut: false, salesPaused: false,
    },
    {
      id: 'sample-2',
      name: 'Treasurer workshop: setting up your campaign books',
      summary: 'A hands-on session for volunteer treasurers. Bring a laptop.',
      url: 'https://events.humanitix.com/',
      image: null,
      start: at(23, 23), end: at(24, 2),
      timezone: 'Australia/Sydney', moreDates: 2,
      location: { type: 'address', venue: 'Sample venue', address: 'Sydney NSW', city: 'Sydney' },
      price: { min: 25, max: 40, currency: 'AUD' },
      soldOut: false, salesPaused: false,
    },
    {
      id: 'sample-3',
      name: 'Community groups and third-party campaigning',
      summary: 'When advocacy becomes electoral expenditure, and what to do about it.',
      url: 'https://events.humanitix.com/',
      image: null,
      start: at(40, 8), end: at(40, 9),
      timezone: 'Australia/Melbourne', moreDates: 0,
      location: { type: 'address', venue: 'Sample venue', address: 'Melbourne VIC', city: 'Melbourne' },
      price: { min: 15, max: 15, currency: 'AUD' },
      soldOut: true, salesPaused: false,
    },
  ];
}
