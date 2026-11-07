const wa = require('./wa');

let timer = null;

function tanggalWIB() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function jamWIB() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

async function cekRekap() {
  if (!wa.siap()) return null;
  if ((await wa.getSetting('wa_rekap_aktif', '1')) === '0') return null;
  const jam = (await wa.getSetting('wa_jam_rekap', '21:00')) || '21:00';
  if (jamWIB() < jam) return null;
  return wa.antreRekapHarian(tanggalWIB());
}

function mulai() {
  if (timer) return timer;
  if (String(process.env.WA_WORKER || '1') === '0') return null;
  const jeda = Math.max(Number(process.env.WA_POLL_MS) || 30000, 5000);
  timer = setInterval(async () => {
    try {
      await wa.prosesOutbox();
      await cekRekap();
    } catch (e) {
      console.error('[wa]', e.message);
    }
  }, jeda);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = { mulai, cekRekap, tanggalWIB, jamWIB };
