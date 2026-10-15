const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

process.env.TZ = 'America/Chicago';
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(file, 'utf8').replace('function ExportDialog(', 'export function ExportDialog(');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, Set, Error, ...globals, require: name => {
    if (!(name in mocks)) throw Error(`Missing mock: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const { selectExportEvents, exportBounds, createCalendarFile } = load('lib/calendar-export.ts');
const event = (id, host_id = 'other', date_time = '2026-10-14T18:00:00Z') => ({
  id, host_id, date_time, title: 'Lunch', description: null, location: null, formatted_address: null,
});
const ids = rows => Array.from(rows, row => row.id).sort();

test('created/joined/union/all filters, dates and duplicate RSVP membership', () => {
  const rows = [event('own', 'me'), event('joined'), event('both', 'me'), event('public'), event('joined'), event('undated', 'me', null), event('bad', 'me', 'invalid')];
  const joined = new Set(['joined', 'both', 'inaccessible']);
  const expected = { created: ['both', 'own'], joined: ['both', 'joined'], 'created-joined': ['both', 'joined', 'own'], all: ['both', 'joined', 'own', 'public'] };
  for (const [scope, values] of Object.entries(expected)) {
    assert.deepEqual(ids(selectExportEvents(rows, joined, 'me', scope, {})), values);
  }
});

test('date range includes the entire last local day; excludes next midnight', () => {
  const bounds = exportBounds('custom', '2026-10-14', '2026-10-14');
  const rows = [event('before', 'me', '2026-10-14T04:59:59Z'), event('start', 'me', '2026-10-14T05:00:00Z'), event('end', 'me', '2026-10-15T04:59:59Z'), event('after', 'me', '2026-10-15T05:00:00Z')];
  assert.deepEqual(ids(selectExportEvents(rows, new Set(), 'me', 'created', bounds)), ['end', 'start']);
});

test('inclusive dates follow daylight saving transitions without losing an hour', () => {
  const spring = exportBounds('custom', '2026-03-08', '2026-03-08');
  const fall = exportBounds('custom', '2026-11-01', '2026-11-01');
  assert.equal(spring.until - spring.from, 23 * 3600000);
  assert.equal(fall.until - fall.from, 25 * 3600000);
  assert.throws(() => exportBounds('custom', '2026-10-15', '2026-10-14'), /End date/);
  assert.throws(() => exportBounds('custom', '2026-02-30', '2026-03-01'), /valid/);
});

test('upcoming and this month have independent, deterministic bounds', () => {
  const now = new Date('2026-10-14T18:00:00Z');
  assert.equal(exportBounds('upcoming', '', '', now).from, now.getTime());
  const month = exportBounds('month', '', '', now);
  assert.equal(new Date(month.from).toISOString(), '2026-10-01T05:00:00.000Z');
  assert.equal(new Date(month.until).toISOString(), '2026-11-01T05:00:00.000Z');
  assert.equal(Object.keys(exportBounds('all', '', '')).length, 0);
});

test('ICS exports UTC start time, stable UID and address, with no fabricated end time', () => {
  const row = { ...event('abc', 'me', '2026-10-14T13:00:00-05:00'), location: 'Campus', formatted_address: '123 Main St' };
  const file = createCalendarFile([row, row], new Date('2026-10-13T12:30:00Z'));
  assert.match(file, /^BEGIN:VCALENDAR\r\nVERSION:2.0\r\n/);
  assert.match(file, /DTSTART:20261014T180000Z\r\n/);
  assert.match(file, /DTSTAMP:20261013T123000Z\r\n/);
  assert.match(file, /UID:abc@rollin-app.org\r\n/);
  assert.match(file, /LOCATION:123 Main St\r\n/);
  assert.equal(file.match(/BEGIN:VEVENT/g).length, 1);
  assert.ok(!file.includes('DTEND'));
  assert.ok(file.endsWith('END:VCALENDAR\r\n'));
  assert.throws(() => createCalendarFile([]), /No events/);
  assert.throws(() => createCalendarFile([event('missing', 'me', null)]), /start date/);
});

test('ICS text cannot inject properties, escapes delimiters, and folds Unicode by byte count', () => {
  const row = { ...event('unicode'), title: 'Music 🎉 café '.repeat(15), description: 'a,b;c\\d\r\nBEGIN:VEVENT\nhello', location: 'Room, 1; Hall' };
  const file = createCalendarFile([row]);
  for (const line of file.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  const unfolded = file.replace(/\r\n /g, '');
  assert.ok(unfolded.includes(`SUMMARY:${row.title}\r\n`));
  assert.ok(unfolded.includes('DESCRIPTION:a\\,b\\;c\\\\d\\nBEGIN:VEVENT\\nhello\r\n'));
  assert.ok(unfolded.includes('LOCATION:Room\\, 1\\; Hall\r\n'));
  assert.equal(file.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
});

function dataService({ user = 'me', cap = 500, fail = false } = {}) {
  const rows = Array.from({ length: 1103 }, (_, i) => event(String(i)));
  const joins = rows.filter((_, i) => i % 2 === 0).map(row => ({ activity_id: row.id }));
  const requests = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: user } }, error: null }) },
    from(table) {
      let from, through;
      const query = {
        select() { return query; },
        eq(column, value) { assert.equal(table, 'rsvps'); assert.equal(column, 'user_id'); assert.equal(value, 'me'); return query; },
        order(column) { assert.equal(column, table === 'rsvps' ? 'activity_id' : 'id'); return query; },
        range(start, end) { from = start; through = end; return query; },
        async abortSignal(signal) {
          assert.equal(signal.aborted, false);
          requests.push({ table, from });
          if (fail && table === 'activities' && from > 0) return { data: null, error: Error('offline') };
          return { data: (table === 'activities' ? rows : joins).slice(from, Math.min(through + 1, from + cap)), error: null };
        },
      };
      return query;
    },
  };
  return { ...load('lib/calendar-export-data.ts', { '@/lib/supabase': { supabase } }), requests };
}

test('load every page even when the server row cap is smaller than the requested page', async () => {
  for (const cap of [500, 100]) {
    const service = dataService({ cap });
    const data = await service.loadCalendarExport('me', new AbortController().signal);
    assert.equal(data.events.length, 1103);
    assert.equal(data.joinedIds.size, 552);
    assert.ok(service.requests.some(row => row.from >= 1000));
  }
});

test('failed pages, changed accounts and canceled loads never produce a partial export', async () => {
  await assert.rejects(dataService({ fail: true }).loadCalendarExport('me', new AbortController().signal), /Could not load/);
  const switched = dataService({ user: 'different' });
  await assert.rejects(switched.loadCalendarExport('me', new AbortController().signal), /Sign in again/);
  assert.equal(switched.requests.length, 0);
  const controller = new AbortController(); controller.abort();
  const canceled = dataService();
  await assert.rejects(canceled.loadCalendarExport('me', controller.signal), /closed/);
  assert.equal(canceled.requests.length, 0);
});

test('native sharing keeps the file readable after the chooser closes and cleans old exports only', async () => {
  const files = [];
  class File {
    constructor(_directory, name) { this.uri = `file:///calendar-exports/${name}`; this.exists = false; this.modificationTime = Date.now(); files.push(this); }
    create() { this.exists = true; }
    write(value) { this.contents = value; }
    delete() { this.exists = false; }
  }
  const old = new File(null, 'old.ics'); old.create(); old.modificationTime -= 2 * 86400000;
  const recent = new File(null, 'recent.ics'); recent.create();
  class Directory { create() {} list() { return [...files]; } }
  const service = load('lib/share-calendar.ts', {
    'expo-file-system': { File, Directory, Paths: { cache: 'cache' } },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri, options) => {
      assert.equal(options.mimeType, 'text/calendar'); assert.equal(files.find(file => file.uri === uri).contents, 'calendar data');
    } },
  });
  await service.shareCalendar('calendar data', 'new.ics');
  assert.equal(old.exists, false);
  assert.equal(recent.exists, true);
  assert.equal(files.at(-1).exists, true);
});

test('browser export downloads an ICS blob and releases its URL', async () => {
  let clicked = false, removed = false, revoked, blob;
  const link = { click() { clicked = true; }, remove() { removed = true; } };
  const service = load('lib/share-calendar.web.ts', {}, {
    Blob, URL: { createObjectURL(value) { blob = value; return 'blob:test'; }, revokeObjectURL(value) { revoked = value; } },
    document: { createElement: () => link, body: { appendChild() {} } },
    setTimeout: fn => fn(),
  });
  await service.shareCalendar('calendar data', 'rollin.ics');
  assert.equal(link.download, 'rollin.ics'); assert.equal(link.href, 'blob:test');
  assert.equal(await blob.text(), 'calendar data'); assert.equal(blob.type, 'text/calendar;charset=utf-8');
  assert.ok(clicked && removed); assert.equal(revoked, 'blob:test');
});

// Exercise the actual component handlers using a minimal hook runtime, without
// native modules or network access. Device layout/share-sheet testing is separate.
const settle = () => new Promise(resolve => setImmediate(resolve));
function dialog({ fetchData, share = async () => {} }) {
  const slots = [], effects = [], pending = [];
  let cursor = 0, closed = 0;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useEffect(fn, deps) { const i = cursor++; const old = effects[i]; if (!old || deps.some((value, j) => value !== old.deps[j])) pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const { ExportDialog } = load('components/calendar/export-events.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ActivityIndicator: 'Spinner', Modal: 'Modal', Pressable: 'Button', ScrollView: 'Scroll', View: 'View', StyleSheet: { create: value => value } },
    'react-native-calendars': { Calendar: 'Calendar' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/text': { AppText: 'Text' }, '@/hooks/use-auth-context': {},
    '@/lib/calendar-export': load('lib/calendar-export.ts'),
    '@/lib/calendar-export-data': { loadCalendarExport: fetchData },
    '@/lib/share-calendar': { shareCalendar: share },
  }, { AbortController });
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]; }
  function text(node) { return typeof node === 'string' || typeof node === 'number' ? String(node) : [node?.props?.children].flat(Infinity).map(child => child ? text(child) : '').join(''); }
  function render() { cursor = 0; const tree = ExportDialog({ userId: 'me', selectedDate: '2026-10-14', onClose: () => closed++ }); while (pending.length) pending.shift()(); return tree; }
  return {
    render, text: () => text(render()),
    button: label => nodes(render()).find(n => n.type === 'Button' && text(n) === label),
    calendar: () => nodes(render()).find(n => n.type === 'Calendar'),
    closed: () => closed, unmount: () => effects.forEach(e => e?.cleanup?.()),
  };
}

test('export panel combines event groups with dates and exports the chosen events only', async () => {
  let content;
  const ui = dialog({ fetchData: async () => ({ events: [event('own', 'me'), event('joined'), event('public')], joinedIds: new Set(['joined']) }), share: async value => { content = value; } });
  assert.equal(ui.button('Export calendar file').props.disabled, true);
  await settle();
  ui.button('All dates').props.onPress();
  assert.ok(ui.text().includes('2 events selected'));
  ui.button('All events').props.onPress();
  assert.ok(ui.text().includes('3 events selected'));
  ui.button('Events I joined').props.onPress();
  ui.button('Date range').props.onPress();
  ui.button('Through2026-10-31').props.onPress();
  ui.calendar().props.onDayPress({ dateString: '2026-10-14' });
  assert.ok(ui.text().includes('1 event selected'));
  await ui.button('Export calendar file').props.onPress();
  assert.match(content, /UID:joined@rollin-app.org/);
  assert.ok(!content.includes('UID:own@'));
  assert.equal(ui.closed(), 1);
  ui.unmount();
});

test('export panel blocks empty results, supports retry, and keeps share failures visible', async () => {
  let calls = 0;
  const ui = dialog({ fetchData: async () => {
    if (!calls++) throw Error('Offline');
    return { events: [event('own', 'me')], joinedIds: new Set() };
  }, share: async () => { throw Error('Sharing unavailable'); } });
  ui.render(); await settle();
  assert.ok(ui.text().includes('Offline'));
  assert.equal(ui.button('Export calendar file').props.disabled, true);
  ui.button('Retry').props.onPress(); ui.render(); await settle();
  ui.button('All dates').props.onPress(); ui.button('Events I joined').props.onPress();
  assert.equal(ui.button('Export calendar file').props.disabled, true);
  ui.button('Events I created').props.onPress();
  await ui.button('Export calendar file').props.onPress();
  assert.ok(ui.text().includes('Sharing unavailable'));
  assert.equal(ui.closed(), 0);
  assert.equal(ui.button('Export calendar file').props.disabled, false);
  ui.unmount();
});
