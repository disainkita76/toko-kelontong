/**
 * Toko Aneka - Database Layer (IndexedDB)
 * Offline-first persistent storage for products, categories, transactions, and settings.
 */

const DB_NAME = 'TokoAnekaDB';
const DB_VERSION = 2;

let dbInstance = null;

// Buka koneksi database IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Object Store: categories
      if (!db.objectStoreNames.contains('categories')) {
        const catStore = db.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('name', 'name', { unique: false });
      }

      // Object Store: products (stokis)
      if (!db.objectStoreNames.contains('products')) {
        const prodStore = db.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('barcode', 'barcode', { unique: false });
        prodStore.createIndex('name', 'name', { unique: false });
        prodStore.createIndex('categoryId', 'categoryId', { unique: false });
      }

      // Object Store: transactions
      if (!db.objectStoreNames.contains('transactions')) {
        const trxStore = db.createObjectStore('transactions', { keyPath: 'id' });
        trxStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
        trxStore.createIndex('dateStr', 'dateStr', { unique: false });
        trxStore.createIndex('monthStr', 'monthStr', { unique: false });
        trxStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Object Store: settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Object Store: users (kasir & admin)
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('username', 'username', { unique: true });
        userStore.createIndex('role', 'role', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Helper Generic CRUD
async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function dbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Transaksi khusus filter
async function dbGetTransactionsByDate(dateStr) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const index = store.index('dateStr');
    const req = index.getAll(dateStr);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetTransactionsByMonth(monthStr) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const index = store.index('monthStr');
    const req = index.getAll(monthStr);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// Cari Pengguna berdasarkan Username
async function dbGetUserByUsername(username) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const index = store.index('username');
    const req = index.get(username);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// Inisialisasi data bawaan jika toko baru dibuka
async function initSeedData() {
  const categories = await dbGetAll('categories');
  if (categories.length === 0) {
    const defaultCategories = [
      { id: 'cat-sembako', name: 'Sembako & Beras', icon: 'fa-wheat-awn', color: '#16a34a' },
      { id: 'cat-minuman', name: 'Minuman & Kopi', icon: 'fa-mug-hot', color: '#0284c7' },
      { id: 'cat-makanan', name: 'Makanan & Mi Instan', icon: 'fa-bowl-food', color: '#ea580c' },
      { id: 'cat-bumbu', name: 'Bumbu & Dapur', icon: 'fa-pepper-hot', color: '#dc2626' },
      { id: 'cat-kebersihan', name: 'Sabun & Kebersihan', icon: 'fa-soap', color: '#9333ea' },
      { id: 'cat-lainnya', name: 'Rokok & Lainnya', icon: 'fa-box-open', color: '#475569' }
    ];

    for (const cat of defaultCategories) {
      await dbPut('categories', cat);
    }
  }

  const products = await dbGetAll('products');
  if (products.length === 0) {
    const defaultProducts = [
      {
        id: 'prd-001',
        barcode: '089686010118',
        name: 'Indomie Goreng Spesial 85g',
        categoryId: 'cat-makanan',
        buyPrice: 2800,
        sellPrice: 3500,
        stock: 120,
        minStock: 24,
        unit: 'Bungkus'
      },
      {
        id: 'prd-002',
        barcode: '8992775211025',
        name: 'Minyak Goreng Bimoli 1 Liter',
        categoryId: 'cat-sembako',
        buyPrice: 17500,
        sellPrice: 20000,
        stock: 35,
        minStock: 10,
        unit: 'Pouch'
      },
      {
        id: 'prd-003',
        barcode: '8991002100054',
        name: 'Beras Ramos Super 5 Kg',
        categoryId: 'cat-sembako',
        buyPrice: 65000,
        sellPrice: 72000,
        stock: 20,
        minStock: 5,
        unit: 'Karung'
      },
      {
        id: 'prd-004',
        barcode: '8993005110123',
        name: 'Gulaku Kuning Premium 1 Kg',
        categoryId: 'cat-sembako',
        buyPrice: 15500,
        sellPrice: 17500,
        stock: 45,
        minStock: 15,
        unit: 'Bungkus'
      },
      {
        id: 'prd-005',
        barcode: '8992771001019',
        name: 'Aqua Air Mineral 600ml',
        categoryId: 'cat-minuman',
        buyPrice: 2600,
        sellPrice: 3500,
        stock: 80,
        minStock: 24,
        unit: 'Botol'
      },
      {
        id: 'prd-006',
        barcode: '8991001230112',
        name: 'Kopi Kapal Api Spesial Mix 1 Renceng',
        categoryId: 'cat-minuman',
        buyPrice: 12000,
        sellPrice: 14500,
        stock: 30,
        minStock: 10,
        unit: 'Renceng'
      },
      {
        id: 'prd-007',
        barcode: '8992741911124',
        name: 'Teh Celup Sosro Isi 30',
        categoryId: 'cat-minuman',
        buyPrice: 6000,
        sellPrice: 7500,
        stock: 25,
        minStock: 8,
        unit: 'Kotak'
      },
      {
        id: 'prd-008',
        barcode: '8999999052028',
        name: 'Sunlight Jeruk Nipis 650ml',
        categoryId: 'cat-kebersihan',
        buyPrice: 12500,
        sellPrice: 15000,
        stock: 28,
        minStock: 10,
        unit: 'Pouch'
      },
      {
        id: 'prd-009',
        barcode: '8999999051014',
        name: 'Rinso Anti Noda 770g',
        categoryId: 'cat-kebersihan',
        buyPrice: 18000,
        sellPrice: 21500,
        stock: 15,
        minStock: 5,
        unit: 'Bungkus'
      },
      {
        id: 'prd-010',
        barcode: '2000000000018',
        name: 'Telur Ayam Negeri 1 Kg',
        categoryId: 'cat-sembako',
        buyPrice: 26000,
        sellPrice: 29000,
        stock: 40,
        minStock: 10,
        unit: 'Kg'
      },
      {
        id: 'prd-011',
        barcode: '8996001301017',
        name: 'Roma Biskuit Kelapa 300g',
        categoryId: 'cat-makanan',
        buyPrice: 9000,
        sellPrice: 11000,
        stock: 3,
        minStock: 10, // status stok menipis untuk demonstrasi alert
        unit: 'Bungkus'
      },
      {
        id: 'prd-012',
        barcode: '8998866100019',
        name: 'Masako Rasa Sapi 1 Renceng',
        categoryId: 'cat-bumbu',
        buyPrice: 5000,
        sellPrice: 6500,
        stock: 50,
        minStock: 12,
        unit: 'Renceng'
      }
    ];

    for (const prod of defaultProducts) {
      await dbPut('products', prod);
    }
  }

  // Pengaturan toko default
  const storeInfo = await dbGetById('settings', 'storeInfo');
  if (!storeInfo) {
    await dbPut('settings', {
      key: 'storeInfo',
      storeName: 'Toko Aneka',
      tagline: 'Sedia Sembako, Kebutuhan Dapur & Harian Lengkap',
      address: 'Jl. Melati No. 45, RT 02 / RW 05',
      phone: '0812-9876-5432',
      receiptFooter: 'Terima kasih atas kunjungan Anda di Toko Aneka!\nBarang yang sudah dibeli tidak dapat ditukar kembali.'
    });
  }

  // Pengaturan QRIS bawaan
  const qrisInfo = await dbGetById('settings', 'qrisInfo');
  if (!qrisInfo) {
    await dbPut('settings', {
      key: 'qrisInfo',
      enabled: true,
      merchantName: 'Toko Aneka',
      nmid: 'ID1020030040050',
      instruction: 'Buka aplikasi m-Banking (BCA, Mandiri, BRI, BNI) atau e-Wallet (GoPay, OVO, DANA, ShopeePay) lalu scan barcode QRIS ini.',
      qrImage: '' // Gambar barcode QRIS yang dapat diupload oleh pemilik toko
    });
  }

  // Cek jika belum ada akun pengguna, tambahkan akun default Admin & Kasir
  const users = await dbGetAll('users');
  if (users.length === 0) {
    const defaultUsers = [
      {
        id: 'usr-admin',
        username: 'admin',
        password: 'admin123',
        name: 'Administrator Toko',
        role: 'admin',
        avatarIcon: 'fa-user-shield',
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-kasir',
        username: 'kasir',
        password: 'kasir123',
        name: 'Kasir 1',
        role: 'kasir',
        avatarIcon: 'fa-user-tag',
        createdAt: new Date().toISOString()
      }
    ];

    for (const u of defaultUsers) {
      await dbPut('users', u);
    }
  }

  // Cek jika belum ada transaksi, tambahkan sampel transaksi harian & bulanan realistis
  const txs = await dbGetAll('transactions');
  if (txs.length === 0) {
    await seedSampleTransactions();
  }
}

// Generate beberapa transaksi sampel untuk tanggal hari ini dan beberapa hari lalu
async function seedSampleTransactions() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const monthStr = `${year}-${month}`;

  const sampleTrxList = [
    {
      id: 'trx-' + Date.now() + '-1',
      invoiceNumber: `TRX-${year}${month}${day}-001`,
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30, 15).getTime(),
      dateStr: todayStr,
      timeStr: '08:30:15',
      monthStr: monthStr,
      items: [
        { productId: 'prd-001', barcode: '089686010118', name: 'Indomie Goreng Spesial 85g', price: 3500, buyPrice: 2800, qty: 5, subtotal: 17500, profit: 3500 },
        { productId: 'prd-002', barcode: '8992775211025', name: 'Minyak Goreng Bimoli 1 Liter', price: 20000, buyPrice: 17500, qty: 1, subtotal: 20000, profit: 2500 }
      ],
      total: 37500,
      cash: 50000,
      change: 12500,
      profit: 6000,
      paymentMethod: 'Tunai'
    },
    {
      id: 'trx-' + Date.now() + '-2',
      invoiceNumber: `TRX-${year}${month}${day}-002`,
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 15, 0).getTime(),
      dateStr: todayStr,
      timeStr: '10:15:00',
      monthStr: monthStr,
      items: [
        { productId: 'prd-003', barcode: '8991002100054', name: 'Beras Ramos Super 5 Kg', price: 72000, buyPrice: 65000, qty: 1, subtotal: 72000, profit: 7000 },
        { productId: 'prd-004', barcode: '8993005110123', name: 'Gulaku Kuning Premium 1 Kg', price: 17500, buyPrice: 15500, qty: 2, subtotal: 35000, profit: 4000 },
        { productId: 'prd-010', barcode: '2000000000018', name: 'Telur Ayam Negeri 1 Kg', price: 29000, buyPrice: 26000, qty: 1, subtotal: 29000, profit: 3000 }
      ],
      total: 136000,
      cash: 150000,
      change: 14000,
      profit: 14000,
      paymentMethod: 'Tunai'
    },
    {
      id: 'trx-' + Date.now() + '-3',
      invoiceNumber: `TRX-${year}${month}${day}-003`,
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 45, 20).getTime(),
      dateStr: todayStr,
      timeStr: '14:45:20',
      monthStr: monthStr,
      items: [
        { productId: 'prd-005', barcode: '8992771001019', name: 'Aqua Air Mineral 600ml', price: 3500, buyPrice: 2600, qty: 3, subtotal: 10500, profit: 2700 },
        { productId: 'prd-006', barcode: '8991001230112', name: 'Kopi Kapal Api Spesial Mix 1 Renceng', price: 14500, buyPrice: 12000, qty: 1, subtotal: 14500, profit: 2500 }
      ],
      total: 25000,
      cash: 25000,
      change: 0,
      profit: 5200,
      paymentMethod: 'QRIS'
    }
  ];

  // Tambahkan transaksi beberapa hari sebelumnya di bulan yang sama untuk grafik bulanan
  const pastDays = [1, 2, 3, 5, 7, 10];
  for (let i = 0; i < pastDays.length; i++) {
    const pDayNum = pastDays[i];
    if (pDayNum < parseInt(day, 10)) {
      const pDayStr = String(pDayNum).padStart(2, '0');
      const datePast = `${year}-${month}-${pDayStr}`;
      const omzet = 180000 + (pDayNum * 25000);
      const profit = Math.round(omzet * 0.16);

      sampleTrxList.push({
        id: `trx-past-${pDayNum}`,
        invoiceNumber: `TRX-${year}${month}${pDayStr}-001`,
        timestamp: new Date(year, now.getMonth(), pDayNum, 11, 0, 0).getTime(),
        dateStr: datePast,
        timeStr: '11:00:00',
        monthStr: monthStr,
        items: [
          { productId: 'prd-003', barcode: '8991002100054', name: 'Beras Ramos Super 5 Kg', price: 72000, buyPrice: 65000, qty: 2, subtotal: 144000, profit: 14000 },
          { productId: 'prd-002', barcode: '8992775211025', name: 'Minyak Goreng Bimoli 1 Liter', price: 20000, buyPrice: 17500, qty: 3, subtotal: 60000, profit: 7500 }
        ],
        total: omzet,
        cash: omzet,
        change: 0,
        profit: profit,
        paymentMethod: 'Tunai'
      });
    }
  }

  for (const trx of sampleTrxList) {
    await dbPut('transactions', trx);
  }
}
