// Events page: loads upcoming events from /api/events (which reads Humanitix)
// and renders one card per event.
(function () {
  var list = document.getElementById('events-list');
  var empty = document.getElementById('events-empty');
  var demo = document.getElementById('events-demo');
  if (!list) return;

  fetch('/api/events', { headers: { accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var events = (data && data.events) || [];
      if (data && data.demo && demo) demo.hidden = false;
      if (!events.length) return showEmpty();
      list.innerHTML = '';
      events.forEach(function (e) { list.appendChild(card(e)); });
    })
    .catch(showEmpty);

  function showEmpty() {
    list.innerHTML = '';
    list.hidden = true;
    if (empty) empty.hidden = false;
  }

  function card(e) {
    var tz = e.timezone || 'Australia/Melbourne';
    var start = new Date(e.start);
    var end = new Date(e.end);

    var el = document.createElement('article');
    el.className = 'event-card';

    var date = document.createElement('div');
    date.className = 'event-date';
    date.setAttribute('aria-hidden', 'true');
    date.innerHTML =
      '<span class="ed-month">' + fmt(start, tz, { month: 'short' }) + '</span>' +
      '<span class="ed-day">' + fmt(start, tz, { day: 'numeric' }) + '</span>' +
      '<span class="ed-weekday">' + fmt(start, tz, { weekday: 'short' }) + '</span>';
    el.appendChild(date);

    var body = document.createElement('div');
    body.className = 'event-body';

    var h = document.createElement('h2');
    h.className = 'event-name';
    h.textContent = e.name;
    body.appendChild(h);

    var meta = document.createElement('p');
    meta.className = 'event-meta';
    meta.textContent = whenText(start, end, tz) + '  ·  ' + whereText(e.location);
    body.appendChild(meta);

    if (e.summary) {
      var p = document.createElement('p');
      p.className = 'event-summary';
      p.textContent = e.summary;
      body.appendChild(p);
    }

    var foot = document.createElement('div');
    foot.className = 'event-foot';

    var price = priceText(e.price);
    if (price) {
      var pr = document.createElement('span');
      pr.className = 'event-price';
      pr.textContent = price;
      foot.appendChild(pr);
    }
    if (e.moreDates > 0) {
      var md = document.createElement('span');
      md.className = 'event-more';
      md.textContent = '+' + e.moreDates + ' more date' + (e.moreDates === 1 ? '' : 's');
      foot.appendChild(md);
    }

    var closed = e.soldOut || e.salesPaused;
    if (closed) {
      var badge = document.createElement('span');
      badge.className = 'event-badge';
      badge.textContent = e.soldOut ? 'Sold out' : 'Bookings paused';
      foot.appendChild(badge);
    }

    var a = document.createElement('a');
    a.className = 'btn ' + (closed ? 'btn-secondary' : 'btn-primary');
    a.href = e.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = closed ? 'View event' : 'Get tickets';
    a.setAttribute('aria-label', a.textContent + ': ' + e.name + ' (opens Humanitix)');
    foot.appendChild(a);

    body.appendChild(foot);
    el.appendChild(body);

    if (e.image) {
      var img = document.createElement('img');
      img.className = 'event-image';
      img.src = e.image;
      img.alt = '';
      img.loading = 'lazy';
      el.appendChild(img);
      el.classList.add('has-image');
    }
    return el;
  }

  function fmt(d, tz, opts) {
    opts.timeZone = tz;
    return new Intl.DateTimeFormat('en-AU', opts).format(d);
  }

  function whenText(start, end, tz) {
    var day = fmt(start, tz, { weekday: 'long', day: 'numeric', month: 'long' });
    var t = { hour: 'numeric', minute: '2-digit' };
    var sameDay = fmt(start, tz, { dateStyle: 'short' }) === fmt(end, tz, { dateStyle: 'short' });
    var zone = fmt(end, tz, { timeZoneName: 'short' }).split(' ').pop();
    if (sameDay) return day + ', ' + fmt(start, tz, t) + ' to ' + fmt(end, tz, t) + ' ' + zone;
    return day + ', ' + fmt(start, tz, t) + ' to ' + fmt(end, tz, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' ' + zone;
  }

  function whereText(loc) {
    loc = loc || {};
    if (loc.type === 'online') return 'Online';
    if (loc.type === 'toBeAnnounced') return 'Venue to be announced';
    return [loc.venue, loc.city || loc.address].filter(Boolean).join(', ') || 'Venue to be announced';
  }

  function priceText(p) {
    if (!p) return '';
    var money = function (n) { return '$' + (Number.isInteger(n) ? n : n.toFixed(2)); };
    if (!p.max) return 'Free';
    if (!p.min) return 'Free to ' + money(p.max);
    if (p.min === p.max) return money(p.min);
    return money(p.min) + ' to ' + money(p.max);
  }
})();
