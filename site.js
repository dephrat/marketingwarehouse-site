// iPhones before iOS 15.4 have no Array.prototype.at; this file uses it.
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', { value(i) { const n = Math.trunc(i) || 0; return this[n < 0 ? this.length + n : n]; }, configurable: true, writable: true });
}

// Opening photos fade in once loaded (the CSS keeps them hidden until then).
document.querySelectorAll('.shot img').forEach((img) => {
  const show = () => img.classList.add('is-loaded');
  if (img.complete && img.naturalWidth) show();
  else { img.addEventListener('load', show, { once: true }); img.addEventListener('error', show, { once: true }); }
});

// If anything below throws, show everything rather than leave content hidden.
window.addEventListener('error', () => {
  document.documentElement.classList.remove('reveal-on');
  document.querySelector('.stage')?.classList.remove('stage-js');
});

// Mobile menu toggle, and the demo quote form: it checks required fields and
// shows a thank-you, but never stores or sends anything.
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  const form = document.getElementById('quote-form');
  if (form) {
    // /quote/?occasion=tradeshow ticks the matching "What is it for?" box.
    const occasion = new URLSearchParams(location.search).get('occasion');
    if (occasion) {
      const slug = (value) => value.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
      for (const box of form.querySelectorAll('input[name="event"]')) {
        if (slug(box.value) === occasion) box.checked = true;
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const first = form.elements['first-name'].value.trim();
      document.getElementById('thanks-name').textContent = first ? `, ${first}` : '';
      form.hidden = true;
      const thanks = document.getElementById('thanks');
      thanks.hidden = false;
      thanks.focus();
      form.reset();
    });
  }
});

// V3 motion. Everything stays still for visitors who ask their device for
// reduced motion; the page reads the same without any of it.
document.addEventListener('DOMContentLoaded', () => {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero: a stack of project photos, linked to the scroll position the way
  // Apple's product pages are. Every frame, each photo's place in the stack is
  // worked out from how far the page has scrolled (eased, so a flick glides
  // instead of ticking). Scroll down and the front photo slides away and fades
  // while the next comes forward; scroll up and it plays backwards. At the
  // very top, with nobody scrolling, the stack drifts on to the next photo by itself.
  const stage = document.querySelector('.stage');
  if (stage) {
    const shots = [...stage.querySelectorAll('.shot')];
    const n = shots.length;
    const place = (front) => shots.forEach((shot, i) => {
      shot.dataset.pos = String((i - front + n) % n);
    });
    if (calm) {
      place(0);
    } else {
      stage.classList.add('stage-js');
      const inner = stage.querySelector('.stage-inner');
      const hero = stage.closest('section');
      const copy = hero.querySelector('.hero3d-copy');
      const phone = window.matchMedia('(max-width: 860px)');
      // Where a photo sits at each place in the stack: x and y shift (% of the
      // photo's own size), depth (px) and opacity. -1 = leaving: it slides off
      // sideways and fades, so it never sits on top of the next photo (to the right
      // on desktop, away from the headline; to the left on phones). 0 = front,
      // 4 = hidden at the back.
      const DESKTOP = [
        [78, 30, 120, 0], [0, 0, 0, 1], [14, -52, -140, 0.7], [-14, 54, -240, 0.45], [4, -100, -340, 0.22], [4, -100, -420, 0],
      ];
      const PHONE = [
        [-78, 16, 100, 0], [0, 0, 0, 1], [12, -28, -140, 0.7], [-12, 26, -240, 0.45], [4, -50, -340, 0.22], [4, -50, -420, 0],
      ];
      const lerp = (a, b, t) => a + (b - a) * t;
      const pose = (pos) => {
        const frames = phone.matches ? PHONE : DESKTOP;
        const k = Math.max(-1, Math.min(4, pos)) + 1;
        const lo = Math.floor(k), hi = Math.min(lo + 1, frames.length - 1), t = k - lo;
        return frames.at(lo).map((v, j) => lerp(v, frames.at(hi).at(j), t));
      };

      let auto = 0;          // photos advanced by the idle drift at the top
      let shown = 0;         // eased value actually drawn
      let tilt = 0;          // eased scroll progress, for the swing
      let hovered = false;
      let mouseX = 0, mouseY = 0, mx = 0, my = 0;
      let idleSince = performance.now();
      let last = performance.now();
      let running = false;

      // V5: the hero is pinned (sticky) inside a taller .hero-track, so progress is
      // how far the track has scrolled past the pin point. Where the pin is turned
      // off (short screens), fall back to how far the hero itself has scrolled.
      const track = hero.closest('.hero-track');
      const bar = stage.querySelector('.stage-progress span');
      const progress = () => {
        if (track) {
          const pinTop = parseFloat(getComputedStyle(hero).top) || 0;
          const scrollable = track.offsetHeight - hero.offsetHeight;
          if (scrollable > 40) {
            const p = (pinTop - track.getBoundingClientRect().top) / scrollable;
            return Math.min(1, Math.max(0, p));
          }
        }
        const range = hero.offsetTop + hero.offsetHeight * 0.75;
        return Math.min(1, Math.max(0, window.scrollY / range));
      };

      const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const p = progress();
        if (window.scrollY < 8 && !hovered && now - idleSince > 3200) {
          auto += 1;
          idleSince = now;
        }
        // Each photo rests alone in front for most of its stretch of scroll and
        // hands over in the middle 40%, so wherever the thumb stops it lands on a
        // clean photo, never two half-faded ones (smoothstep across the handover).
        const raw = p * (n - 1);
        const whole = Math.floor(raw), part = raw - whole;
        const h = Math.min(1, Math.max(0, (part - 0.3) / 0.4));
        const target = auto + whole + h * h * (3 - 2 * h);
        const ease = 1 - Math.exp(-dt * 20); // close to the thumb: ~50ms behind, just enough to smooth jitter
        shown += (target - shown) * ease;
        tilt += (p - tilt) * ease;
        mx += (mouseX - mx) * ease;
        my += (mouseY - my) * ease;

        shots.forEach((shot, i) => {
          let pos = (((i - shown) % n) + n) % n; // 0 .. n
          if (pos > n - 1) pos -= n;             // the one just past front flies out
          const [x, y, z, o] = pose(pos);
          shot.style.transform = `translate(${x - 50}%, ${y - 50}%) translateZ(${z}px)`;
          shot.style.opacity = o.toFixed(3);
          shot.style.zIndex = String(10 - Math.round(pos * 2));
          shot.style.setProperty('--cap', Math.max(0, 1 - Math.abs(pos) * 2.5).toFixed(3));
          shot.style.pointerEvents = Math.abs(pos) < 0.5 ? 'auto' : 'none';
        });
        inner.style.setProperty('--ry', `${-14 + mx * 12 + tilt * 26}deg`);
        inner.style.setProperty('--rx', `${6 - my * 8}deg`);
        inner.style.setProperty('--stx', `${tilt * 18}px`);
        // Pinned, the hook stays put and readable; only the photos travel.
        if (copy && !track) {
          copy.style.setProperty('--cty', `${tilt * -36}px`);
          copy.style.opacity = (1 - tilt * 0.35).toFixed(3);
        }
        if (bar) bar.style.transform = `scaleX(${tilt.toFixed(4)})`;
        hero.style.setProperty('--cue', Math.max(0, 1 - tilt * 6).toFixed(3));
        if (running) requestAnimationFrame(frame);
      };

      new IntersectionObserver(([entry]) => {
        const was = running;
        running = entry.isIntersecting;
        if (running && !was) { last = performance.now(); requestAnimationFrame(frame); }
      }).observe(hero);

      window.addEventListener('scroll', () => { idleSince = performance.now(); }, { passive: true });
      // Real mouse only: a touch fires mouseenter with no mouseleave, which would
      // stop the idle rotation for good on phones.
      stage.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') hovered = true; });
      stage.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') { hovered = false; idleSince = performance.now(); } });
      hero.addEventListener('mousemove', (event) => {
        const box = hero.getBoundingClientRect();
        mouseX = (event.clientX - box.left) / box.width - 0.5;
        mouseY = (event.clientY - box.top) / box.height - 0.5;
      });
    }
  }

  if (calm || !('IntersectionObserver' in window)) return;

  // Sections fade up as they scroll into view.
  const targets = document.querySelectorAll('.section-head, .offer, .card:not(.hl-card), .steps li, .stats-grid > div, .cta, .contact-box, .callout, .prose, .store, fieldset, .chips, .chips-note, .page-head .wrap');
  document.documentElement.classList.add('reveal-on');
  const siblingsSeen = new Map();
  targets.forEach((el) => {
    el.dataset.reveal = '';
    const n = siblingsSeen.get(el.parentElement) || 0;
    siblingsSeen.set(el.parentElement, n + 1);
    el.style.setProperty('--delay', `${Math.min(n, 3) * 0.12}s`);
  });
  // Headings rise in word by word.
  document.querySelectorAll('.section-head h2, .cta h2, .prose h2').forEach((h2) => {
    if (h2.children.length) return; // only plain-text headings
    const words = h2.textContent.trim().split(/\s+/);
    h2.textContent = '';
    words.forEach((word, i) => {
      const outer = document.createElement('span');
      outer.className = 'w';
      const inner = document.createElement('span');
      inner.textContent = word;
      inner.style.setProperty('--wd', `${Math.min(i * 0.07, 0.7)}s`);
      outer.append(inner);
      h2.append(outer, i < words.length - 1 ? ' ' : '');
    });
  });
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in');
      reveal.unobserve(entry.target);
    }
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' }); // play just as it comes on screen, so it's seen
  targets.forEach((el) => reveal.observe(el));

  // Numbers count up the first time they appear.
  const counters = document.querySelectorAll('[data-count]');
  const count = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      count.unobserve(el);
      const end = Number(el.dataset.count);
      const prefix = el.dataset.prefix || '';
      const started = performance.now();
      const step = (now) => {
        const t = Math.min((now - started) / 1400, 1);
        const value = Math.round(end * (1 - Math.pow(1 - t, 3)));
        el.textContent = prefix + value.toLocaleString('en-CA');
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { threshold: 0.6 });
  counters.forEach((el) => count.observe(el));
});

// V4: client logos you can play with. Each row drifts on its own; scrolling
// pushes both rows along (scroll up and they run backwards), and a finger or
// mouse can drag a row and fling it. Rows only animate while on screen.
document.addEventListener('DOMContentLoaded', () => {
  const marquee = document.querySelector('.marquee');
  if (!marquee || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  marquee.classList.add('marquee-js');

  const rows = [...marquee.querySelectorAll('.marquee-track')].map((track) => ({
    track,
    dir: track.classList.contains('reverse') ? 1 : -1,
    x: 0,
    fling: 0,
  }));
  const BASE = 28; // px per second
  let boost = 0;
  let visible = false;
  let last = performance.now();

  // Each row's loop length, measured once (and again on resize or when an image
  // finishes loading), never inside the frame loop: reading scrollWidth right
  // after moving the other row forced a full layout every frame, which showed
  // up as lag while dragging (V13).
  const measure = () => rows.forEach((row) => { row.half = row.track.scrollWidth / 2; });
  measure();
  window.addEventListener('resize', measure);
  marquee.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure));
  const wrap = (row) => {
    if (!row.half) return;
    row.x = ((row.x % row.half) - row.half) % row.half; // keep x in (-half, 0]
  };

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const row of rows) {
      if (!row.dragging) {
        const drift = row.hovered ? 0 : BASE;
        row.x += row.dir * (drift + boost) * dt + row.fling * dt;
        row.fling *= Math.pow(0.04, dt); // fling fades out over about a second
      }
      wrap(row);
      row.track.style.transform = `translate3d(${row.x}px, 0, 0)`;
    }
    boost *= Math.pow(0.08, dt);
    if (visible) requestAnimationFrame(frame);
  };

  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(marquee);

  // Scrolling doesn't push the rows (V11): Dan preferred the calm phone feel,
  // steady drift plus drag, everywhere. Kept switched off rather than deleted.
  let lastY = window.scrollY;
  if (false) window.addEventListener('scroll', () => {
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    boost = Math.max(-900, Math.min(900, boost + dy * 6));
  }, { passive: true });

  // Dragging a row. Vertical swipes still scroll the page (touch-action: pan-y).
  for (const row of rows) {
    let startX = 0, startRowX = 0, lastMoveX = 0, lastMoveT = 0, speed = 0;
    row.track.addEventListener('pointerdown', (event) => {
      row.dragging = true;
      startX = lastMoveX = event.clientX;
      startRowX = row.x;
      lastMoveT = event.timeStamp;
      speed = 0;
      row.track.setPointerCapture(event.pointerId);
    });
    row.track.addEventListener('pointermove', (event) => {
      if (!row.dragging) return;
      row.x = startRowX + (event.clientX - startX);
      const dt = (event.timeStamp - lastMoveT) / 1000;
      if (dt > 0) speed = (event.clientX - lastMoveX) / dt;
      lastMoveX = event.clientX;
      lastMoveT = event.timeStamp;
    });
    const release = () => {
      if (!row.dragging) return;
      row.dragging = false;
      row.fling = Math.max(-2500, Math.min(2500, speed));
    };
    row.track.addEventListener('pointerup', release);
    row.track.addEventListener('pointercancel', release);
  }
  // Pause on a real mouse hover only. A touch also fires a fake mouseenter but
  // never the matching mouseleave, which left the rows paused for good after a
  // thumb rested on them (V11 bug).
  // Each row pauses on its own while the mouse is over it (V13); the other keeps drifting.
  for (const row of rows) {
    row.track.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') row.hovered = true; });
    row.track.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') row.hovered = false; });
  }

  // Decode the logo images ahead of time, so the first swipe doesn't stall
  // while the phone prepares them.
  marquee.querySelectorAll('img').forEach((img) => { if (img.decode) img.decode().catch(() => {}); });

  const hint = document.createElement('p');
  hint.className = 'marquee-hint';
  hint.textContent = window.matchMedia('(pointer: coarse)').matches ? 'Swipe to browse' : 'Drag to browse';
  marquee.after(hint);
});

// V6, after Apple's iPhone pages.
document.addEventListener('DOMContentLoaded', () => {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Projects gallery, pinned like NaturLoop's loop section. The section
  //    sticks under the header and scrolling down slides the cards sideways;
  //    when the last card is in, the page carries on. Dragging the cards
  //    sideways works too, and a dot jumps there. The dots follow the cards live: the long one slides between
  //    positions as the cards move. Screens too short to fit the pinned section,
  //    and visitors who ask for reduced motion, get a plain swipeable row instead.
  const pin = document.querySelector('.hl-pin');
  const hl = document.querySelector('.hl');
  if (pin && hl) {
    const sticky = pin.querySelector('.proof');
    const track = hl.querySelector('.hl-track');
    const items = [...track.children];
    const dots = [...hl.querySelectorAll('.hl-dot')];
    const n = items.length;
    let pinned = false, distance = 0, scrollable = 0, dragOffset = 0;

    const count = pin.querySelector('.hl-count b');
    const hint = pin.querySelector('.hl-hint');
    // One white pill glides over eight fixed dots. Moving it is a transform the
    // phone does cheaply; V10 resized the dots every frame, which re-laid out the
    // row ~60 times a second and made the gallery feel laggy. Class and text
    // changes happen only when the active card changes.
    const dotRow = hl.querySelector('.hl-dots');
    const pill = document.createElement('span');
    pill.className = 'hl-pill';
    dotRow.append(pill);
    let shownActive = -1, lastHint = '', pillStart = 0, pitch = 0;
    const measureDots = () => { pillStart = dots[0].offsetLeft + dots[0].offsetWidth / 2 - 4; pitch = dots[1].offsetLeft - dots[0].offsetLeft; };
    measureDots();
    window.addEventListener('resize', measureDots);
    const drawDots = (f) => {
      pill.style.transform = `translate3d(${(pillStart + f * pitch).toFixed(1)}px, 0, 0)`;
      // Fully visible until halfway to the second card, gone by the third (V13:
      // it used to vanish in the first quarter card, before people could read it).
      const h = pinned ? Math.min(1, Math.max(0, 1.6 - f)).toFixed(2) : '0';
      if (hint && h !== lastHint) { hint.style.opacity = h; lastHint = h; }
      const active = Math.round(f);
      if (active === shownActive) return;
      shownActive = active;
      if (count) count.textContent = String(active + 1);
      items.forEach((item, i) => item.classList.toggle('is-active', i === active));
      dots.forEach((dot, i) => dot.setAttribute('aria-current', i === active ? 'true' : 'false'));
    };
    const header = () => parseFloat(getComputedStyle(sticky).top) || 0;
    const layout = () => {
      // V21: the pin is off for everyone. iPhone Safari fought the pinned
      // scroll-to-slide, so the gallery is now always a plain row of cards you
      // swipe sideways (native scrolling with snap); vertical swipes just scroll
      // the page past it. The pinned code below is kept but never runs.
      pinned = false;
      pin.classList.toggle('is-pinned', pinned);
      if (!pinned) { pin.style.height = ''; track.style.transform = ''; return; }
      // Slide until the last card has the same gap from the right edge as the
      // first card has from the left. (track.scrollWidth leaves out the right
      // padding, so the last card used to end flush against the edge.)
      const last = items[n - 1];
      const edge = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      distance = Math.max(0, last.offsetLeft + last.offsetWidth + edge - hl.clientWidth);
      pin.style.height = `${sticky.offsetHeight + distance}px`;
      scrollable = Math.max(1, pin.offsetHeight - sticky.offsetHeight);
      update();
    };
    const progress = () => Math.min(1, Math.max(0, (header() - pin.getBoundingClientRect().top) / scrollable));
    const update = () => {
      if (pinned) {
        const p = progress();
        const x = Math.min(0, Math.max(-distance, -p * distance + dragOffset));
        track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
        drawDots((-x / Math.max(1, distance)) * (n - 1));
      } else {
        const step = n > 1 ? items[1].offsetLeft - items[0].offsetLeft : 1;
        drawDots(Math.min(n - 1, Math.max(0, track.scrollLeft / step)));
      }
    };
    let pending = false;
    const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; update(); }); } };
    window.addEventListener('scroll', schedule, { passive: true });
    track.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', layout);
    window.addEventListener('load', layout);

    // Page scroll position (pinned) for showing card i.
    const scrollFor = (i) => pin.getBoundingClientRect().top + window.scrollY - header() + (i / (n - 1)) * scrollable;
    dots.forEach((dot, i) => dot.addEventListener('click', () => {
      if (pinned) window.scrollTo({ top: scrollFor(i), behavior: 'smooth' });
      else track.scrollTo({ left: items[i].offsetLeft - (parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0), behavior: calm ? 'auto' : 'smooth' });
    }));

    // Pinned: dragging the cards sideways follows the finger (or mouse) live,
    // like scrolling does: right-to-left moves forward, left-to-right back.
    // While the finger is down only the cards move (an extra offset on top of
    // the scroll position), so nothing fights the phone's own vertical
    // scrolling; on release the page jumps silently to the matching scroll
    // position and the offset is dropped in the same frame, so nothing moves.
    // V19: a sideways move counts sooner (6px, more sideways than up), and on
    // release the cards keep gliding with the flick's speed, then ease to a
    // stop, instead of stopping dead under the finger.
    // V20: the flick's speed comes from the finger's last ~100ms of travel
    // (real fingers slow down and report a few still points just before
    // lifting, which zeroed V19's running average), and the glide is animated
    // here frame by frame instead of with the browser's smooth scroll, which a
    // phone can cancel as the touch ends.
    let startX = 0, startY = 0, tracking = false, moved = false, samples = [], gliding = 0;
    const flickSpeed = () => {
      const now = samples.at(-1);
      if (!now) return 0;
      const old = samples.find((s) => now.t - s.t <= 100) || samples[0];
      const dt = (now.t - old.t) / 1000;
      return dt > 0.016 ? (now.x - old.x) / dt : 0;
    };
    const glideTo = (from, to) => {
      const id = ++gliding, began = performance.now(), length = 520;
      const step = (now) => {
        if (id !== gliding) return;
        const k = Math.min(1, (now - began) / length);
        window.scrollTo(0, from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    // Mouse and pen use pointer events; fingers use the touch events below.
    track.addEventListener('pointerdown', (event) => {
      if (!pinned || event.pointerType === 'touch') return;
      gliding++; // a new touch stops any glide in progress
      tracking = true; moved = false; dragOffset = 0;
      startX = event.clientX; startY = event.clientY;
      samples = [{ x: event.clientX, t: event.timeStamp }];
    });
    track.addEventListener('pointermove', (event) => {
      if (!tracking) return;
      const dx = event.clientX - startX, dy = event.clientY - startY;
      if (!moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) { moved = true; track.setPointerCapture(event.pointerId); }
      samples.push({ x: event.clientX, t: event.timeStamp });
      if (samples.length > 20) samples.shift();
      if (!moved) return;
      // Keep the cards within the gallery's ends.
      const p = progress();
      dragOffset = Math.max(-(1 - p) * distance, Math.min(p * distance, dx));
      schedule();
    });
    const release = () => {
      if (!tracking) return;
      tracking = false;
      if (!moved || !dragOffset) { dragOffset = 0; return; }
      const p = Math.min(1, Math.max(0, progress() - dragOffset / Math.max(1, distance)));
      const base = pin.getBoundingClientRect().top + window.scrollY - header();
      const top = base + p * scrollable;
      dragOffset = 0;
      window.scrollTo({ top, behavior: 'auto' });
      update();
      // Glide: carry on about a third of a second's worth of the flick's speed.
      const speed = flickSpeed();
      if (Math.abs(speed) > 120) {
        const glide = Math.max(-1, Math.min(1, -speed * 0.34 / Math.max(1, distance)));
        glideTo(top, base + Math.min(1, Math.max(0, p + glide)) * scrollable);
      }
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);

    // Fingers: touch events, so the page can claim a sideways swipe. iPhone
    // Safari doesn't reliably leave sideways gestures to the page the way
    // touch-action: pan-y asks; it took the swipe as a page scroll and the
    // cards never moved. Calling preventDefault() on a non-passive touchmove,
    // once the swipe is clearly more sideways than vertical, stops Safari (and
    // Chrome) from scrolling for that touch. Vertical swipes are left alone.
    let axis = null;
    track.addEventListener('touchstart', (event) => {
      if (!pinned || event.touches.length !== 1) return;
      const touch = event.touches[0];
      gliding++; // a new touch stops any glide in progress
      tracking = true; moved = false; axis = null; dragOffset = 0;
      startX = touch.clientX; startY = touch.clientY;
      samples = [{ x: touch.clientX, t: event.timeStamp }];
    }, { passive: true });
    track.addEventListener('touchmove', (event) => {
      if (!tracking || axis === 'y') return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX, dy = touch.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y') { tracking = false; return; }
      }
      event.preventDefault();
      moved = true;
      samples.push({ x: touch.clientX, t: event.timeStamp });
      if (samples.length > 20) samples.shift();
      const p = progress();
      dragOffset = Math.max(-(1 - p) * distance, Math.min(p * distance, dx));
      schedule();
    }, { passive: false });
    track.addEventListener('touchend', release);
    track.addEventListener('touchcancel', release);
    track.addEventListener('click', (event) => { if (moved) { event.preventDefault(); moved = false; } }, true);
    // Safari starts its own drag-and-drop when you drag a link or photo, which
    // swallowed the release (no pointerup), so the cards stuck and never glided.
    track.addEventListener('dragstart', (event) => event.preventDefault());
    track.addEventListener('wheel', (event) => {
      if (!pinned || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      window.scrollBy(0, event.deltaX * (scrollable / Math.max(1, distance)));
    }, { passive: false });

    layout();
  }

  // 2. A statement that lights up word by word as it scrolls through the screen,
  //    and dims again on the way back up.
  const lit = document.querySelector('.lit-text');
  if (lit && !calm) {
    const words = lit.textContent.trim().split(/\s+/);
    lit.textContent = '';
    const spans = words.map((word, i) => {
      const span = document.createElement('span');
      span.className = 'lw';
      span.textContent = word;
      span.style.setProperty('--l', '0');
      lit.append(span, i < words.length - 1 ? ' ' : '');
      return span;
    });
    let pending = false;
    const update = () => {
      pending = false;
      const box = lit.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.82 - box.top) / (box.height + vh * 0.32)));
      const reached = p * spans.length;
      spans.forEach((span, i) => span.style.setProperty('--l', Math.min(1, Math.max(0, reached - i)).toFixed(2)));
    };
    window.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // 3. "What are you planning?": pick one and the matching real project shows,
  //    with a button that starts a quote for it. Arrow keys move between choices.
  const tabs = [...document.querySelectorAll('.plan-tab')];
  if (tabs.length) {
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    };
    tabs.forEach((tab, i) => {
      tab.tabIndex = i === 0 ? 0 : -1;
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (event) => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (step) { event.preventDefault(); select(tabs.at((i + step + tabs.length) % tabs.length), true); }
      });
    });
  }
});
