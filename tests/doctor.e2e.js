// Drives OPflow for Doctors in headless Chrome against a local API on a THROWAWAY database, and presses every
// button: first login → Today console (start, call next, done, skip, did not come, put back, break, late, pause,
// end) → live update in a second tab → bookings (open/close hours, a booking, ask new time, cancel) → timings →
// leave → emergency → messages → settings → profile → password → Telugu → log out. Screenshots in ./shots.
//
// Usage: API on :3100 (seeded with `npm run seed:demo`, DOCTOR_WEB_KEY set), site on :3003 (`npm run build &&
// npm start` with .env.local pointing at :3100), then: node tests/doctor.e2e.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { execFileSync } = require('child_process');

const SITE = process.env.SITE ?? 'http://localhost:3003';
const API = process.env.API ?? 'http://localhost:3100';
const PSQL = process.env.PSQL ?? 'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const DB = process.env.PGDB_ARGS ? process.env.PGDB_ARGS.split(' ') : ['-h', 'localhost', '-p', '5499', '-U', 'postgres', '-d', 'opflow_test'];
const chrome = process.env.CHROME ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
fs.mkdirSync('shots', { recursive: true });

const sql = (q) => execFileSync(PSQL, [...DB, '-Atqc', q]).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
};

async function api(method, path, body, token) {
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: r.status, body: json ?? text };
}

const istDate = (offsetDays = 0) => new Date(Date.now() + 330 * 60_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** A patient who books and pays (test gateway) the given window. */
async function patientBooks(n, windowId) {
  const phone = `+9199000000${String(n).padStart(2, '0')}`;
  const login = await api('POST', '/v1/auth/patient/exchange', { idToken: `dev:${phone}`, device: { platform: 'android' } });
  const token = login.body.accessToken;
  await api('PATCH', '/v1/me', { name: `Web Patient ${n}`, age: 30 + n, gender: n % 2 ? 'female' : 'male' }, token);
  const hold = await api('POST', '/v1/bookings/hold', { windowId, note: n === 1 ? 'Fever for two days' : undefined }, token);
  if (hold.status !== 201) throw new Error(`hold ${n}: ${JSON.stringify(hold.body)}`);
  const paid = await api('POST', '/v1/dev/razorpay/pay', { orderId: hold.body.payment.orderId });
  const v = await api('POST', '/v1/payments/verify', paid.body, token);
  if (v.body?.booking?.status !== 'confirmed') throw new Error(`verify ${n}: ${JSON.stringify(v.body)}`);
  return v.body.booking;
}

(async () => {
  // ── Data: Dr. Srinivas Rao's OPD tomorrow gets 3 patients, then that OPD is moved to today (a live line to run).
  const docs = await api('GET', '/v1/doctors?limit=50');
  const rao = docs.body.items.find((d) => d.name === 'Dr. Srinivas Rao');
  const tomorrow = istDate(1);
  const wins = (await api('GET', `/v1/doctors/${rao.id}/windows?date=${tomorrow}`)).body.filter((w) => w.bookable && w.free >= 3);
  const w = wins[0];
  const booked = [];
  for (let i = 1; i <= 3; i++) booked.push(await patientBooks(i, w.id));
  // Two more on a later day, for "ask to pick a new time" and "cancel".
  const later = istDate(3);
  const w2 = (await api('GET', `/v1/doctors/${rao.id}/windows?date=${later}`)).body.find((x) => x.bookable && x.free >= 2);
  const moveMe = await patientBooks(4, w2.id);
  const cancelMe = await patientBooks(5, w2.id);
  const today = istDate(0);
  const sid = w.sessionId;
  // Today's own OPDs for this doctor (nobody booked in them) make room; tomorrow's OPD becomes today's.
  sql(`delete from opd_sessions s where s.doctor_id = '${rao.id}' and s.date = '${today}' and not exists (select 1 from bookings b where b.session_id = s.id)`);
  sql(`update opd_sessions set date = '${today}', starts_at = starts_at - interval '1 day', ends_at = ends_at - interval '1 day' where id = '${sid}'`);
  sql(`update opd_windows set starts_at = starts_at - interval '1 day', ends_at = ends_at - interval '1 day' where session_id = '${sid}'`);
  sql(`update bookings set session_date = '${today}' where session_id = '${sid}'`);
  check('Test data: 3 patients in today\'s OPD, 2 on a later day', booked.length === 3 && !!moveMe && !!cancelMe);

  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--window-size=1440,900'] });
  const pageErrors = [];
  const ctx = await browser.createBrowserContext();
  const newPage = async () => {
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    p.on('pageerror', (e) => pageErrors.push(e.message));
    p.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) pageErrors.push(m.text() + ' @ ' + (m.location()?.url ?? ''));
    });
    return p;
  };
  const go = async (p, path) => p.goto(SITE + path, { waitUntil: 'networkidle0' });
  // Text as one line (names can wrap on narrow cards).
  const text = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const has = async (p, s) => (await text(p)).includes(s);
  const waitText = async (p, s, timeout = 15_000) => {
    try {
      await p.waitForFunction((t) => document.body.innerText.replace(/\s+/g, ' ').includes(t), { timeout, polling: 200 }, s);
      return true;
    } catch {
      return false;
    }
  };
  // Server actions change pages inside the app (no full page load): wait for the address instead.
  const waitUrl = async (p, part, timeout = 20_000) => {
    try {
      await p.waitForFunction((x) => location.pathname.includes(x), { timeout, polling: 200 }, part);
      await p.waitForNetworkIdle({ idleTime: 400, timeout: 15_000 }).catch(() => null);
      return true;
    } catch {
      await p.screenshot({ path: `shots/stuck-${part.replace(/\W/g, '')}.png` });
      return false;
    }
  };
  // Press a console key once the console is free (keys are ignored while a command is on its way, on purpose).
  const pressWhenFree = async (p, key) => {
    await p.waitForFunction(() => ![...document.querySelectorAll('.callnext, .now-card button')].some((b) => b.disabled), { timeout: 15_000, polling: 200 }).catch(() => null);
    await p.keyboard.press(key);
  };
  const clickText = async (p, t, sel = 'button, a') => {
    await p.waitForFunction((t, sel) => [...document.querySelectorAll(sel)].some((b) => b.innerText.trim().includes(t) && !b.disabled && b.offsetParent !== null), { timeout: 15_000, polling: 200 }, t, sel);
    await p.evaluate((t, sel) => [...document.querySelectorAll(sel)].find((b) => b.innerText.trim().includes(t) && !b.disabled && b.offsetParent !== null).click(), t, sel);
    await sleep(250);
  };

  // Answer an "Are you sure?" question.
  const yes = (p, label) => clickText(p, label, 'dialog[open] button');
  const a = await newPage();
  // ── 1. Sign in (first time: set own password) ──
  await go(a, '/today');
  check('No session → sent to login', a.url().includes('/sign-in'));
  await a.screenshot({ path: 'shots/01-sign-in.png' });
  await a.type('input[name=loginId]', 'opd-10234');
  await a.type('input[name=password]', 'wrong-password');
  await a.click('button.btn:not(.small)');
  check('Wrong password → the server\'s words, no crash', await waitText(a, 'not right'), (await text(a)).slice(0, 120));
  await a.click('input[name=password]', { clickCount: 3 });
  await a.keyboard.press('Backspace');
  await a.type('input[name=password]', 'demo1234');
  await a.click('button.btn:not(.small)');
  check('First login → set your own password', await waitUrl(a, '/new-password'), a.url());
  await a.type('input[name=password]', 'Desk-Doctor-2026');
  await a.type('input[name=again]', 'Desk-Doctor-2026');
  await clickText(a, 'Save password');
  check('Password set → Today', await waitUrl(a, '/today'), a.url());

  // The doctor's phone signs in too; then the website signs in again: the phone must keep working.
  const phone = await api('POST', '/v1/auth/doctor/login', { loginId: 'OPD-10234', password: 'Desk-Doctor-2026', device: { platform: 'android' } });
  check('Phone app signs in', phone.status === 200);

  // ── 2. Today: before the OPD ──
  await go(a, '/today');
  check('Today: START OPD and the expected patients', (await has(a, 'START OPD')) && (await has(a, 'Web Patient 1')) && (await has(a, 'Web Patient 3')));
  check('Today: OPD hours card', await has(a, 'OPD HOURS TODAY'));
  await a.screenshot({ path: 'shots/02-today-before.png' });
  // The app's OP loader covers the screen while the OPD starts (watched from before the click: it is quick).
  await a.evaluate(() => {
    window.__sawLoader = '';
    new MutationObserver(() => {
      const d = document.querySelector('dialog.op-screen[open]');
      if (d && !window.__sawLoader) window.__sawLoader = d.textContent + (d.querySelector('svg.op-loader') ? ' +svg' : '');
    }).observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  await clickText(a, 'START OPD');
  check('START OPD asks first', await waitText(a, 'Start OPD now?'));
  await yes(a, 'Yes, start OPD');
  check('START OPD → CALL NEXT', await waitText(a, 'CALL NEXT'));
  const saw = await a.evaluate(() => window.__sawLoader);
  check('START OPD shows the OP loader', saw.includes('Starting OPD') && saw.includes('+svg'), saw);

  // A second tab (the doctor's other screen): it must follow the line by itself.
  const b = await newPage();
  await go(b, '/today');
  await sleep(1500);

  // ── 3. Console buttons ──
  await a.keyboard.press('n');
  check('Key N: calls the next patient', await waitText(a, 'WITH DOCTOR NOW') && (await waitText(a, 'Web Patient 1')));
  check('Live: the other tab shows it at once', await waitText(b, 'Skip for now', 8000));
  await a.bringToFront(); // back to the main screen (background tabs pause their timers)
  await a.screenshot({ path: 'shots/03-today-running.png' });
  await pressWhenFree(a, 'd');
  await sleep(1200);
  check('Key D: done', (await a.evaluate(() => document.querySelector('.stats.five .fern b')?.textContent)) === '1');
  await pressWhenFree(a, 'n');
  await a.waitForFunction(() => document.querySelector('.now-card')?.innerText.replace(/\s+/g, ' ').includes('Web Patient 2'), { timeout: 15_000, polling: 200 }).catch(async (e) => {
    await a.screenshot({ path: 'shots/stuck-call2.png', fullPage: true });
    console.log('DEBUG now:', await a.evaluate(() => (document.querySelector('.now-card, .nobody')?.innerText ?? '').slice(0, 200)));
    console.log('DEBUG toasts:', await a.evaluate(() => document.querySelector('.toasts')?.innerText));
    throw e;
  });
  await clickText(a, 'Skip for now');
  check('Skip: moved to the end of the line', await waitText(a, 'Moved to the end of the line'));
  await pressWhenFree(a, 'n');
  await a.waitForFunction(() => !!document.querySelector('.now-card'), { timeout: 15_000, polling: 200 });
  await clickText(a, 'Did not come', '.now-card button');
  check('Did not come asks first', await waitText(a, 'as did not come?'));
  await yes(a, 'Yes, did not come');
  check('Did not come', await waitText(a, 'marked as did not come'));
  // Put back via the line's menu (the patient marked did not come).
  const put = await a.evaluate(() => {
    const row = [...document.querySelectorAll('.pt')].find((r) => r.innerText.includes('Did not come') && r.querySelector('.menu button'));
    row?.querySelector('.menu button')?.click();
    return !!row;
  });
  await sleep(300);
  if (put) await clickText(a, 'Put back in line', '.menu .pop button');
  check('Put back in line', put && (await waitText(a, 'is back in the line')));
  await pressWhenFree(a, 'b');
  check('Key B: break', await waitText(a, 'You are on break'));
  await pressWhenFree(a, 'b');
  check('Key B again: working again', await waitText(a, 'OPD started again'));
  await clickText(a, 'I am late');
  await clickText(a, '+10 min', 'dialog button');
  check('I am late: +10 min', await waitText(a, '10 min late'));
  await clickText(a, 'I am late');
  await clickText(a, 'Back on time', 'dialog button');
  check('Back on time', await waitText(a, 'On time'));
  await clickText(a, 'Pause bookings', '.tool');
  await clickText(a, 'Yes, pause bookings', 'dialog button');
  check('Pause bookings', await waitText(a, 'Resume bookings'));
  const paused = (await api('GET', '/v1/doctor/me', null, phone.body.accessToken)).body.bookingsPaused;
  check('…the server has it (the phone sees it)', paused === true);
  await clickText(a, 'Resume bookings', '.tool');
  await clickText(a, 'Yes, take bookings', 'dialog button');
  check('Resume bookings', await waitText(a, 'Pause bookings'));
  await clickText(a, 'END OPD');
  await clickText(a, 'Move them to another day', 'dialog button');
  check('END OPD → OPD is over', await waitText(a, 'OPD is over'));
  await a.screenshot({ path: 'shots/04-today-ended.png' });

  // ── 4. Bookings ──
  await go(a, `/bookings?date=${later}`);
  check('Bookings: 14-day strip and the day\'s hours', (await a.$$('.day')).length === 14 && (await a.$$('.slot')).length >= 1);
  check('Hours are closed at first (names at a glance only)', !(await a.$('.brow')));
  await a.click('.slot > button');
  await sleep(300);
  check('Click an hour: its patients show', (await a.$$('.brow')).length >= 2);
  await a.click('.slot > button');
  await sleep(300);
  check('Click again: closed', !(await a.$('.brow')));
  await a.screenshot({ path: 'shots/05-bookings.png' });
  await go(a, `/bookings/${moveMe.id}`);
  check('Booking page: name, hospital, history', (await has(a, 'Web Patient 4')) && (await has(a, 'Hospital')) && (await has(a, 'History')));
  await clickText(a, 'Ask to pick a new time');
  await clickText(a, 'Yes, ask them', 'dialog button');
  check('Ask to pick a new time', await waitText(a, 'will pick a new time'));
  await go(a, `/bookings/${cancelMe.id}`);
  await clickText(a, 'Cancel booking');
  await clickText(a, 'I am not well', 'dialog button');
  await clickText(a, 'Yes, cancel', 'dialog button');
  check('Cancel booking (100% money back)', await waitText(a, 'sent back'));
  const c = sql(`select status from bookings where id = '${cancelMe.id}'`);
  check('…the server has it', c === 'cancelled_by_provider', c);

  // ── 5. Timings, leave ──
  await go(a, '/timings');
  const hadMon = await a.$$eval('.wk .d', (d) => d[0]?.querySelectorAll('.blk').length ?? 0);
  if (!hadMon) await clickText(a, '+ Add time');
  const cur = await a.$eval('.wk .d:first-child select[name=perHour]', (e) => e.value);
  await a.select('.wk .d:first-child select[name=perHour]', cur === '6' ? '7' : '6');
  await clickText(a, 'Save');
  check('Timings: asks first', await waitText(a, 'Save your new timings?'));
  await yes(a, 'Yes, save');
  check('Timings: save', await waitText(a, 'Saved'));
  const leaveDay = istDate(20);
  await go(a, '/leave');
  const clicked = await a.evaluate((d) => {
    const btn = [...document.querySelectorAll('.cal button')].find((b) => b.getAttribute('aria-label')?.startsWith(d));
    btn?.click();
    return !!btn;
  }, leaveDay);
  await clickText(a, 'Save leave');
  check('Leave: asks first', await waitText(a, 'Save your leave?'));
  await yes(a, 'Yes, save');
  check('Leave: save a day', clicked && (await waitText(a, 'Leave saved')));
  const leaves = (await api('GET', '/v1/doctor/leaves', null, phone.body.accessToken)).body;
  check('…the server has it', Array.isArray(leaves) && leaves.some((l) => String(l.date).startsWith(leaveDay)));

  // ── 6. Emergency ──
  await go(a, '/today');
  await clickText(a, 'EMERGENCY');
  await clickText(a, 'Available now', 'dialog [role=radio]');
  await clickText(a, 'Save', 'dialog button');
  check('Emergency: available now', await waitText(a, 'On now'));
  const em = (await api('GET', '/v1/doctor/emergency', null, phone.body.accessToken)).body.status;
  check('…the server has it', em === 'available_now', em);
  await clickText(a, 'EMERGENCY');
  await clickText(a, 'Not available', 'dialog [role=radio]');
  await clickText(a, 'Save', 'dialog button');
  check('Emergency: off', await waitText(a, 'Emergency status is off'));

  // ── 7. Messages, settings ──
  await go(a, '/messages');
  check('Messages: the new bookings are there', await has(a, 'New booking'));
  if (await has(a, 'Mark all read')) {
    await clickText(a, 'Mark all read');
    await sleep(800);
  }
  check('Mark all read', !(await has(a, 'Mark all read')));
  await go(a, '/settings');
  await a.screenshot({ path: 'shots/08-settings.png', fullPage: true });
  const sw = await a.evaluate(() => {
    const i = document.querySelector('.rows label.row input[type=checkbox]');
    i?.click();
    return !!i;
  });
  check('Settings: switches shown', sw);
  await sleep(1200);
  const prefs = (await api('GET', '/v1/me/notification-prefs', null, phone.body.accessToken)).body;
  check('Settings: a switch saves', prefs.newBookings === false);
  check('Settings: signed-in devices listed (phone and this browser)', (await has(a, 'Signed in on')) && (await has(a, 'This one')));

  // ── 8. The phone was never signed out by the website ──
  const still = await api('GET', '/v1/doctor/me', null, phone.body.accessToken);
  check('The doctor\'s phone is still signed in', still.status === 200, String(still.status));

  // ── 9. Profile ──
  await go(a, '/profile');
  const years0 = Number(await a.$eval('.card input[type=number]', (e) => e.value));
  await clickText(a, '+');
  await clickText(a, 'Save');
  check('Profile: save', await waitText(a, 'Profile saved'));
  const me = (await api('GET', '/v1/doctor/me', null, phone.body.accessToken)).body;
  check('…the server has it', me.yearsExperience === years0 + 1, `${me.yearsExperience}`);

  // Profile photo: a big photo is shrunk in the browser, uploaded, and the API's copy shows up.
  const sharp = require(require.resolve('sharp', { paths: [__dirname + '/../../backend'] }));
  const big = require('path').resolve(__dirname, '../shots/test-photo.png');
  await sharp({ create: { width: 1800, height: 2400, channels: 3, background: { r: 31, g: 122, b: 92 } } }).png().toFile(big);
  await a.waitForFunction(() => !document.querySelector('dialog.op-screen'), { timeout: 20_000, polling: 200 }); // the profile save has finished
  const file = await a.$('.photo-pick input[type=file]');
  await file.uploadFile(big);
  const uploaded = await waitText(a, 'Photo saved', 30_000);
  check('Photo: uploaded', uploaded, uploaded ? '' : `${await a.evaluate(() => document.querySelector('.toasts')?.textContent ?? '')} ${pageErrors.slice(-3).join(' | ')}`);
  let photoUrl = null;
  for (let i = 0; i < 30 && !photoUrl; i++) {
    await sleep(1500);
    photoUrl = (await api('GET', '/v1/doctor/me', null, phone.body.accessToken)).body.photo?.m ?? null;
  }
  check('Photo: the API made its copies', !!photoUrl, String(photoUrl));
  const img = photoUrl ? await fetch(photoUrl) : null;
  check('Photo: the copy opens', img?.status === 200 && /image/.test(img.headers.get('content-type') ?? ''), `${img?.status} ${img?.headers.get('content-type')}`);
  await sleep(4000);
  await go(a, '/profile');
  check('Photo: shows on the profile', photoUrl ? (await a.$eval('.photo-pick img', (e) => e.getAttribute('src'))) === photoUrl : false);
  await sleep(1500);
  check('Photo: the browser really shows it (no CSP / CORP block)', await a.$eval('.photo-pick img', (e) => e.complete && e.naturalWidth > 0));
  check('Photo: shows in the sidebar too', await a.evaluate(() => !!document.querySelector('.who .avatar img')));
  await a.screenshot({ path: 'shots/09-photo.png' });
  await clickText(a, 'Remove');
  await sleep(400);
  await clickText(a, 'Yes, remove');
  check('Photo: removed', await waitText(a, 'Photo removed'));
  const gone = (await api('GET', '/v1/doctor/me', null, phone.body.accessToken)).body.photo;
  check('…the server has no photo', !gone?.m, JSON.stringify(gone));

  // ── 10. Every page opens without errors; phone width too ──
  await sleep(20_000); // a person's pace (the API allows 240 calls a minute per signed-in device)
  for (const path of ['/today', '/bookings', '/messages', '/timings', '/leave', '/hospitals', '/earnings', '/reports', '/profile', '/settings', '/password']) {
    await go(a, path);
    await sleep(1500);
    check(`Page ${path} opens`, !(await has(a, 'We could not load')) && !(await has(a, 'Application error')));
    if (path === '/hospitals') {
      const hs = await a.$$eval('.cards > .card', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      check('Hospitals: cards are the same size', hs.length > 0 && new Set(hs).size === 1, hs.join(','));
    }
  }
  await a.setViewport({ width: 390, height: 844, isMobile: true });
  await go(a, '/today');
  const overflow = await a.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('Phone width: no sideways scrolling', !overflow);
  await a.screenshot({ path: 'shots/06-phone.png' });
  await a.setViewport({ width: 1440, height: 900 });

  // ── 11. Telugu ──
  await go(a, '/today');
  await clickText(a, 'తెలుగు');
  await sleep(1500);
  check('Telugu: the page switches language', (await a.evaluate(() => document.documentElement.lang)) === 'te' && /[\u0C00-\u0C7F]/.test(await text(a)));
  await a.screenshot({ path: 'shots/07-telugu.png' });
  await clickText(a, 'English');
  await sleep(1200);

  // ── 12. Password, log out ──
  await go(a, '/password');
  await a.type('input[name=current]', 'Desk-Doctor-2026');
  await a.type('input[name=next]', 'Desk-Doctor-2027');
  await a.type('input[name=again]', 'Desk-Doctor-2027');
  await clickText(a, 'Change password', 'form button'); // the form's button, not the menu link of the same name
  check('Change password asks first', await waitText(a, 'Change your password?'));
  await yes(a, 'Yes, change it');
  check('Change password', await waitText(a, 'Password changed'));
  await go(a, '/today');
  await clickText(a, 'Log out');
  check('Log out asks first', await waitText(a, 'Log out?'));
  await yes(a, 'Not now');
  await sleep(500);
  check('…"Not now" keeps the doctor signed in', a.url().includes('/today') && !(await has(a, 'Log out?')));
  await clickText(a, 'Log out');
  await yes(a, 'Yes, log out');
  check('Log out → login page', await waitUrl(a, '/sign-in'));
  await go(a, '/today');
  check('After log out, pages need login again', a.url().includes('/sign-in'));

  check('No errors in the browser', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
