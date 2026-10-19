import { rupiah } from '../api/client';

function garis() {
  return (
    <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />
  );
}

/**
 * Layout struk thermal 58mm — HANYA ini yang dicetak.
 * Dirender tersembunyi di layar (class area-cetak), dimunculkan saat print
 * lewat body.mau-cetak-struk (lihat index.css @media print).
 * Isi sesuai permintaan: Nama Warung, Daftar Belanja, Total, Bayar,
 * Kembalian, ucapan terima kasih. Tanpa elemen dashboard lain.
 */
export default function StrukPrint({ data, namaToko, header, footer }) {
  if (!data) return <div id="cetak-struk" className="area-cetak" aria-hidden />;
  const items = data.items || [];
  const tanggal = data.tanggal || new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div id="cetak-struk" className="area-cetak" aria-hidden>
      <div
        style={{
          width: '58mm',
          maxWidth: '58mm',
          padding: '0 1mm',
          background: '#fff',
          color: '#000',
          fontFamily: `'Courier New', Courier, monospace`,
          fontSize: '9pt',
          lineHeight: 1.35,
        }}
      >
        {/* Nama warung */}
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '12pt', lineHeight: 1.2 }}>
          {namaToko || header || 'Warung Saya'}
        </div>
        {header && namaToko ? (
          <div style={{ textAlign: 'center', fontSize: '8pt' }}>{header}</div>
        ) : null}
        <div style={{ textAlign: 'center', fontSize: '8pt' }}>{tanggal}</div>

        {garis()}

        {/* Daftar belanja */}
        {items.map((it, i) => (
          <div key={it.id || i} style={{ marginBottom: '1mm' }}>
            <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{it.nama}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2mm' }}>
              <span>
                {it.qty} x {Number(it.harga_jual || 0).toLocaleString('id-ID')}
              </span>
              <span style={{ fontWeight: 700 }}>
                {Number((it.harga_jual || 0) * (it.qty || 0)).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        ))}

        {garis()}

        {/* Total / Bayar / Kembalian */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '10pt' }}>
          <span>Total</span>
          <span>{rupiah(data.total)}</span>
        </div>
        {data.dibayar_via === 'kasbon' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Bayar</span>
              <span>KASBON</span>
            </div>
            {data.kasbon_nama ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Atas nama</span>
                <span>{data.kasbon_nama}</span>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Bayar</span>
              <span>{rupiah(data.diterima)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>Kembali</span>
              <span>{rupiah(data.kembalian)}</span>
            </div>
          </>
        )}

        {data.voided_at ? (
          <div style={{ textAlign: 'center', fontWeight: 800, marginTop: '1.5mm' }}>*** STRUK DIBATALKAN ***</div>
        ) : null}

        {garis()}

        {/* Terima kasih */}
        <div style={{ textAlign: 'center', fontSize: '8.5pt' }}>
          {footer || 'Terima kasih sudah belanja!'}
        </div>
        <div style={{ textAlign: 'center', fontSize: '7.5pt', marginTop: '1mm' }}>
          *** Sampai jumpa kembali ***
        </div>
      </div>
    </div>
  );
}
