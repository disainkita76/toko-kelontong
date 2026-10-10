# Toko Aneka - Aplikasi Kasir & Stokis Kelontong Modern

Aplikasi web kasir (*Point of Sale*) dan manajemen stokis/inventaris toko kelontong lengkap dengan pencatatan transaksi harian & bulanan, pemindai barcode, manajemen kategori, dan cetak struk belanja thermal.

---

## 🌟 Fitur Utama

1. **Kasir / Point of Sale (POS)**:
   - Tampilan visual katalog interaktif lengkap dengan **Foto / Gambar Produk**.
   - Pemindaian produk instan melalui **Barcode Scanner USB/Bluetooth** atau **Kamera Laptop/HP**.
   - Input manual pencarian nama & filter kategori produk.
   - Keranjang kasir interaktif (tambah/kurang qty, diskon belanja, hitung kembalian otomatis).
   - Opsi pembayaran multi-metode: **Tunai**, **QRIS (dengan barcode toko & total otomatis)**, dan **Transfer Bank**.
   - Tombol cepat uang pecahan Rupiah (Uang Pas, Rp 20.000, Rp 50.000, Rp 100.000).
   - Cetak struk belanja format thermal 58mm / 80mm bertuliskan nama kasir yang bertugas.

2. **Stokis & Inventaris Barang**:
   - Master katalog barang: **Upload Foto Produk (otomatis dikompres ringan)**, Barcode/SKU, Nama Barang, Kategori, Harga Beli (Modal), Harga Jual, Jumlah Stok, Satuan, dan Batas Stok Minimum.
   - Thumbnail foto produk langsung pada tabel inventaris.
   - Fitur **Quick Restock (+)** untuk menambah stok dengan cepat.
   - **Indikator Stok Menipis & Habis** otomatis.
   - **Generator Barcode Otomatis (EAN-13)** untuk produk tanpa barcode pabrik serta cetak stiker barcode.

3. **Manajemen Kategori Produk**:
   - Tambah, edit, dan hapus kategori belanja (contoh: Sembako, Minuman, Bumbu Dapur, Makanan Ringan, Sabun, dll.).
   - Ikon dan warna kategori yang dapat disesuaikan.
   - Penghitungan jumlah item per kategori secara otomatis.

4. **Pencatatan & Laporan Transaksi Harian**:
   - Pemilihan tanggal transaksi dengan satu klik.
   - Metrik harian: Total Omzet Penjualan, Estimasi Keuntungan / Laba Kotor (khusus admin), Jumlah Struk, dan Rata-rata Belanja.
   - Tabel riwayat transaksi lengkap dengan rincian barang dan nama kasir.
   - Cetak ulang struk transaksi masa lalu.
   - Ekspor laporan harian ke file **CSV / Excel**.

5. **Pencatatan & Laporan Transaksi Bulanan**:
   - Pemilihan bulan dan tahun.
   - Ringkasan omzet bulanan, total profit, margin keuntungan rata-rata, dan rata-rata omzet harian.
   - **Grafik Batang Interaktif (Chart.js)** untuk melihat tren penjualan per tanggal.
   - Tabel rincian per tanggal dengan tombol jalan pintas ke laporan harian.
   - Ekspor rekapitulasi bulanan ke file **CSV / Excel**.

6. **Pengaturan, QRIS & Keamanan Data (Backup & Restore)**:
   - Pengaturan identitas toko (Nama Toko, Alamat, No. Telp/WhatsApp, dan Pesan Penutup Struk).
   - **Pengaturan Pembayaran QRIS**: Upload gambar barcode QRIS resmi toko Anda, atur nama merchant dan kode NMID agar kasir dapat menerima pembayaran QRIS dengan mudah.
   - **Manajemen Akun Pengguna**: Tambah dan kelola akun Kasir & Admin baru.
   - **Backup Data ke JSON**: Amankan seluruh data produk, kategori, transaksi, akun, dan pengaturan ke komputer.
   - **Restore Data dari JSON**: Pulihkan data toko kapan saja.
   - Data tersimpan secara offline-first dan persisten menggunakan **IndexedDB** browser (tidak hilang saat browser ditutup atau komputer dimatikan).

---

## 🚀 Cara Menjalankan Aplikasi

### Cara 1: Sekali Klik (Sangat Direkomendasikan)
Cukup klik dua kali (*double click*) file:
```
start_app.bat
```
Aplikasi akan langsung membuka server lokal dan browser Anda di alamat:
**http://localhost:8080**

### Cara 2: Melalui Terminal PowerShell
Buka PowerShell di folder proyek ini dan jalankan:
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

---

## 📷 Panduan Menggunakan Barcode Scanner

1. **Menggunakan Scanner Tembak (USB / Bluetooth)**:
   - Colokkan scanner barcode Anda ke laptop/komputer.
   - Scanner fisik otomatis berfungsi layaknya keyboard. Pada halaman Kasir, cukup tembakkan scanner ke kemasan produk, item akan langsung masuk ke keranjang belanja dan bersuara 'bip'.
2. **Menggunakan Kamera Laptop / Smartphone**:
   - Klik tombol hijau **"Scan Barcode Kamera"** di bagian atas kanan.
   - Izinkan (*Allow*) browser mengakses kamera Anda.
   - Arahkan kamera ke barcode kemasan barang hingga berbunyi 'bip'.
3. **Mencetak Label Barcode untuk Barang yang Belum Ada Barcode**:
   - Buka menu **Stokis Barang**.
   - Klik ikon barcode kecil di samping kode SKU barang.
   - Klik tombol **"Cetak Label"** untuk mencetak stiker barcode.

---

## 🔐 Akun Login (Kasir & Admin)

Aplikasi dilengkapi sistem autentikasi multi-role berbasis sesi lokal persisten (IndexedDB):

| Peran | Username | Password | Hak Akses Utama |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Akses penuh: POS, Stokis & Harga Modal, Kategori, Laporan Harian & Bulanan (Laba/Margin), Pengaturan & Backup, serta Manajemen Akun Kasir. |
| **Kasir (POS)** | `kasir` | `kasir123` | Operasional kasir: Kasir (POS), pemindaian barcode USB/kamera, cetak struk nota belanja bertuliskan nama kasir, dan riwayat transaksi harian. Akses menu modal/laba disembunyikan. |

*Tips: Pada halaman login, tersedia tombol **"Masuk Cepat Sekali Klik (Demo Akun)"** untuk langsung mencoba akun Kasir atau Admin tanpa perlu mengetik manual.*

---

## 📁 Struktur File Proyek

```
d:/alnafi/
├── index.html          # Antarmuka Single Page Application (SPA) & Layar Login
├── start_app.bat       # Launcher sekali-klik untuk Windows
├── server.ps1          # Server lokal ringan tanpa perlu Node/Python
├── css/
│   └── style.css       # Styling kustom, layout struk thermal, animasi scanner
├── js/
│   ├── db.js           # Mesin IndexedDB lokal persisten & data bawaan
│   ├── auth.js         # Autentikasi sesi & kontrol hak akses Kasir/Admin (RBAC)
│   ├── scanner.js      # Penanganan hardware scanner USB & kamera web
│   └── app.js          # Logika POS, keranjang kasir, laporan, dan grafik
└── README.md           # Panduan lengkap penggunaan
```
