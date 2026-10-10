/**
 * Toko Aneka - Main Application Engine
 * Menghubungkan UI, IndexedDB, Barcode Scanner, POS, Stokis, Kategori, & Laporan Transaksi
 */

class TokoAnekaApp {
  constructor() {
    this.currentView = 'pos';
    this.cart = [];
    this.paymentMethod = 'Tunai';
    this.monthlyChart = null;
    this.activeStoreInfo = null;
    this.activeQrisInfo = null;

    this.init();
  }

  async init() {
    try {
      // Inisialisasi Database & Data Sampel
      await initSeedData();
      
      // Ambil data pengaturan toko & QRIS
      await this.loadStoreSettings();

      // Mulai Jam Digital
      this.startClock();

      // Render data awal
      await this.refreshAllData();

      // Inisialisasi Autentikasi & Sesi Pengguna
      if (window.authManager) {
        await window.authManager.init();
      }

      // Daftarkan event listener
      this.bindEvents();

      console.log('Toko Aneka Application initialized successfully.');
    } catch (err) {
      console.error('Error saat inisialisasi aplikasi:', err);
      this.showToast('Gagal memuat database lokal', 'error');
    }
  }

  // Jam & Tanggal Digital Real-time
  startClock() {
    const clockEl = document.getElementById('current-clock');
    const dateEl = document.getElementById('current-date');
    const update = () => {
      const now = new Date();
      if (clockEl) clockEl.innerText = now.toLocaleTimeString('id-ID');
      if (dateEl) {
        dateEl.innerText = now.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
    };
    update();
    setInterval(update, 1000);
  }

  // Bind event listeners form dan keyboard
  bindEvents() {
    // Input barcode kasir dengan Enter
    const posBarcodeInput = document.getElementById('pos-barcode-input');
    if (posBarcodeInput) {
      posBarcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const code = posBarcodeInput.value.trim();
          if (code) {
            this.handleBarcodeSearch(code);
            posBarcodeInput.value = '';
          }
        }
      });
    }

    // Input pencarian nama produk kasir
    const posSearchInput = document.getElementById('pos-search-input');
    if (posSearchInput) {
      posSearchInput.addEventListener('input', () => this.filterPosProducts());
    }

    // Input pencarian stokis
    const stockSearch = document.getElementById('stock-search');
    if (stockSearch) {
      stockSearch.addEventListener('input', () => this.renderStockList());
    }

    // Shortcut Keyboard F9 untuk bayar
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        if (this.currentView === 'pos' && this.cart.length > 0) {
          this.openPaymentModal();
        }
      }
    });

    // Set default tanggal hari ini pada filter harian & bulanan
    this.setTodayDate();
    this.setCurrentMonth();
  }

  // Muat pengaturan toko & QRIS dari DB
  async loadStoreSettings() {
    const setting = await dbGetById('settings', 'storeInfo');
    if (setting) {
      this.activeStoreInfo = setting;
      const sidebarName = document.getElementById('sidebar-store-name');
      if (sidebarName) sidebarName.innerText = setting.storeName || 'Toko Aneka';

      // Isi form setting
      const sName = document.getElementById('setting-store-name');
      const sPhone = document.getElementById('setting-phone');
      const sAddress = document.getElementById('setting-address');
      const sFooter = document.getElementById('setting-footer');

      if (sName) sName.value = setting.storeName || 'Toko Aneka';
      if (sPhone) sPhone.value = setting.phone || '';
      if (sAddress) sAddress.value = setting.address || '';
      if (sFooter) sFooter.value = setting.receiptFooter || '';
    }

    // Muat pengaturan QRIS
    const qris = await dbGetById('settings', 'qrisInfo');
    if (qris) {
      this.activeQrisInfo = qris;
      const qEnabled = document.getElementById('setting-qris-enabled');
      const qMerchant = document.getElementById('setting-qris-merchant');
      const qNmid = document.getElementById('setting-qris-nmid');
      const qInstruction = document.getElementById('setting-qris-instruction');

      if (qEnabled) qEnabled.checked = qris.enabled !== false;
      if (qMerchant) qMerchant.value = qris.merchantName || '';
      if (qNmid) qNmid.value = qris.nmid || '';
      if (qInstruction) qInstruction.value = qris.instruction || '';

      this.setQrisImagePreview(qris.qrImage || '');
    }
  }

  // Refresh semua data tampilan
  async refreshAllData() {
    await this.renderPosCategories();
    await this.renderPosProducts();
    await this.renderStockList();
    await this.renderCategories();
    await this.updateLowStockBadge();
    await this.loadDailyTransactions();
    await this.loadMonthlyTransactions();
  }

  // Navigasi Tampilan
  switchView(viewName) {
    // Validasi Hak Akses Role (Kasir vs Admin)
    if (window.authManager && !window.authManager.canAccess(viewName)) {
      this.showToast('Akses Dibatasi: Menu ini hanya dapat diakses oleh Admin.', 'error');
      return;
    }

    this.currentView = viewName;

    const views = ['pos', 'stock', 'categories', 'daily', 'monthly', 'settings'];
    const titles = {
      pos: { title: 'Kasir (Point of Sale)', sub: 'Siap Melayani Transaksi' },
      stock: { title: 'Stokis & Inventaris Barang', sub: 'Kelola Katalog & Jumlah Stok Produk' },
      categories: { title: 'Manajemen Kategori', sub: 'Kelompokkan Produk Toko Kelontong' },
      daily: { title: 'Pencatatan Transaksi Harian', sub: 'Pantau Omzet & Struk Penjualan Hari Ini' },
      monthly: { title: 'Laporan Transaksi Bulanan', sub: 'Analisis Penjualan & Grafik Performa Toko' },
      settings: { title: 'Pengaturan Toko & Backup', sub: 'Konfigurasi Struk dan Keamanan Data' }
    };

    views.forEach(v => {
      const viewEl = document.getElementById(`view-${v}`);
      const navEl = document.getElementById(`nav-${v}`);
      if (viewEl) viewEl.classList.toggle('hidden', v !== viewName);
      if (navEl) navEl.classList.toggle('active', v === viewName);
    });

    const pageTitle = document.getElementById('page-title');
    const pageSub = document.getElementById('page-subtitle');
    if (pageTitle && titles[viewName]) pageTitle.innerText = titles[viewName].title;
    if (pageSub && titles[viewName]) pageSub.innerText = titles[viewName].sub;

    // Refresh view spesifik saat dibuka
    if (viewName === 'stock') this.renderStockList();
    if (viewName === 'categories') this.renderCategories();
    if (viewName === 'daily') this.loadDailyTransactions();
    if (viewName === 'monthly') this.loadMonthlyTransactions();
    if (viewName === 'settings') this.renderUsersList();
    if (viewName === 'pos') {
      setTimeout(() => {
        const input = document.getElementById('pos-barcode-input');
        if (input) input.focus();
      }, 100);
    }
  }

  // =========================================================================
  // 1. POINT OF SALE (POS / KASIR)
  // =========================================================================

  async renderPosCategories() {
    const container = document.getElementById('pos-category-pills');
    if (!container) return;

    const categories = await dbGetAll('categories');
    let html = `
      <button onclick="app.filterPosCategory('all')" id="pos-cat-pill-all"
        class="pos-cat-pill shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-sm transition">
        Semua
      </button>
    `;

    categories.forEach(cat => {
      html += `
        <button onclick="app.filterPosCategory('${cat.id}')" id="pos-cat-pill-${cat.id}"
          class="pos-cat-pill shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
          <i class="fa-solid ${cat.icon || 'fa-tag'} mr-1"></i>${cat.name}
        </button>
      `;
    });

    container.innerHTML = html;
  }

  activePosCategory = 'all';

  filterPosCategory(catId) {
    this.activePosCategory = catId;
    document.querySelectorAll('.pos-cat-pill').forEach(el => {
      el.classList.remove('bg-emerald-600', 'text-white');
      el.classList.add('bg-slate-100', 'text-slate-600');
    });
    const selected = document.getElementById(`pos-cat-pill-${catId}`);
    if (selected) {
      selected.classList.remove('bg-slate-100', 'text-slate-600');
      selected.classList.add('bg-emerald-600', 'text-white');
    }
    this.filterPosProducts();
  }

  async filterPosProducts() {
    const keyword = (document.getElementById('pos-search-input')?.value || '').toLowerCase().trim();
    const products = await dbGetAll('products');

    const filtered = products.filter(p => {
      const matchCat = this.activePosCategory === 'all' || p.categoryId === this.activePosCategory;
      const matchKeyword = !keyword || 
        p.name.toLowerCase().includes(keyword) || 
        (p.barcode && p.barcode.toLowerCase().includes(keyword));
      return matchCat && matchKeyword;
    });

    this.renderPosProductGrid(filtered);
  }

  async renderPosProducts() {
    const products = await dbGetAll('products');
    this.renderPosProductGrid(products);
  }

  renderPosProductGrid(products) {
    const grid = document.getElementById('pos-product-grid');
    const empty = document.getElementById('pos-empty-state');
    if (!grid) return;

    if (products.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    grid.innerHTML = products.map(p => {
      const isOutOfStock = p.stock <= 0;
      const isLowStock = p.stock > 0 && p.stock <= (p.minStock || 5);

      let stockBadge = `<span class="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Stok: ${p.stock} ${p.unit || ''}</span>`;
      if (isOutOfStock) {
        stockBadge = `<span class="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-bold">Habis</span>`;
      } else if (isLowStock) {
        stockBadge = `<span class="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">Sisa ${p.stock}</span>`;
      }

      const imageHtml = p.image
        ? `<div class="w-full h-24 bg-slate-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
             <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-200">
           </div>`
        : `<div class="w-full h-20 bg-slate-50 border border-slate-100 rounded-lg mb-2 flex flex-col items-center justify-center text-slate-300">
             <i class="fa-solid fa-basket-shopping text-xl text-slate-300"></i>
             <span class="text-[9px] text-slate-400 mt-0.5">Toko Aneka</span>
           </div>`;

      return `
        <div onclick="${isOutOfStock ? '' : `app.addToCart('${p.id}')`}"
          class="product-card group relative bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between cursor-pointer ${isOutOfStock ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:border-emerald-500'}">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[10px] font-mono text-slate-400 truncate max-w-[100px]">${p.barcode || '-'}</span>
              ${stockBadge}
            </div>
            ${imageHtml}
            <h4 class="font-bold text-xs text-slate-800 line-clamp-2 leading-tight mb-2 group-hover:text-emerald-700 transition">
              ${p.name}
            </h4>
          </div>

          <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span class="font-mono font-bold text-sm text-emerald-600">
              ${this.formatRupiah(p.sellPrice)}
            </span>
            <div class="w-6 h-6 rounded-lg bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white text-emerald-600 flex items-center justify-center transition text-xs">
              <i class="fa-solid fa-plus"></i>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Tambah produk ke keranjang
  async addToCart(productId, qtyToAdd = 1) {
    const product = await dbGetById('products', productId);
    if (!product) return;

    const existingIndex = this.cart.findIndex(item => item.product.id === productId);

    if (existingIndex > -1) {
      const newQty = this.cart[existingIndex].qty + qtyToAdd;
      if (newQty > product.stock) {
        this.showToast(`Stok tidak mencukupi! Sisa stok hanya ${product.stock}`, 'error');
        window.barcodeManager.playBeep(false);
        return;
      }
      this.cart[existingIndex].qty = newQty;
    } else {
      if (qtyToAdd > product.stock) {
        this.showToast(`Stok tidak mencukupi! Sisa stok hanya ${product.stock}`, 'error');
        window.barcodeManager.playBeep(false);
        return;
      }
      this.cart.push({
        product: product,
        qty: qtyToAdd
      });
    }

    window.barcodeManager.playBeep(true);
    this.renderCart();
  }

  // Ubah qty item di keranjang
  updateCartQty(productId, newQty) {
    const index = this.cart.findIndex(item => item.product.id === productId);
    if (index === -1) return;

    newQty = parseInt(newQty, 10);
    if (isNaN(newQty) || newQty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (newQty > this.cart[index].product.stock) {
      this.showToast(`Stok tidak mencukupi! Sisa stok hanya ${this.cart[index].product.stock}`, 'error');
      newQty = this.cart[index].product.stock;
    }

    this.cart[index].qty = newQty;
    this.renderCart();
  }

  // Hapus item dari keranjang
  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.product.id !== productId);
    this.renderCart();
  }

  // Kosongkan keranjang
  clearCart() {
    this.cart = [];
    this.renderCart();
  }

  // Render Keranjang POS
  renderCart() {
    const container = document.getElementById('pos-cart-items');
    const emptyState = document.getElementById('pos-cart-empty');
    const cartCount = document.getElementById('pos-cart-count');
    const btnPay = document.getElementById('btn-pay');

    if (!container) return;

    const totalItemQty = this.cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartCount) cartCount.innerText = `${totalItemQty} item`;

    if (this.cart.length === 0) {
      container.innerHTML = '';
      if (emptyState) {
        container.appendChild(emptyState);
        emptyState.classList.remove('hidden');
      }
      if (btnPay) btnPay.disabled = true;
      this.updateCartTotals();
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (btnPay) btnPay.disabled = false;

    container.innerHTML = this.cart.map(item => {
      const subtotal = item.qty * item.product.sellPrice;
      return `
        <div class="py-2.5 flex items-center justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-xs text-slate-800 truncate">${item.product.name}</h4>
            <div class="text-[11px] text-slate-500 font-mono mt-0.5">
              ${this.formatRupiah(item.product.sellPrice)} / ${item.product.unit || 'pcs'}
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="app.updateCartQty('${item.product.id}', ${item.qty - 1})"
              class="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold transition">
              <i class="fa-solid fa-minus"></i>
            </button>
            <input type="number" min="1" max="${item.product.stock}" value="${item.qty}"
              onchange="app.updateCartQty('${item.product.id}', this.value)"
              class="w-10 text-center text-xs font-bold font-mono border border-slate-200 rounded py-0.5">
            <button onclick="app.updateCartQty('${item.product.id}', ${item.qty + 1})"
              class="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold transition">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>

          <div class="text-right min-w-[70px]">
            <span class="text-xs font-bold font-mono text-slate-800 block">${this.formatRupiah(subtotal)}</span>
            <button onclick="app.removeFromCart('${item.product.id}')" class="text-[10px] text-rose-500 hover:underline">
              Hapus
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.updateCartTotals();
  }

  // Perhitungan Subtotal, Diskon, Grand Total
  updateCartTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.qty * item.product.sellPrice), 0);
    const discountInput = document.getElementById('pos-discount');
    let discount = parseInt(discountInput?.value || 0, 10);
    if (isNaN(discount) || discount < 0) discount = 0;

    const grandTotal = Math.max(0, subtotal - discount);

    const subtotalEl = document.getElementById('pos-subtotal');
    const grandTotalEl = document.getElementById('pos-grand-total');

    if (subtotalEl) subtotalEl.innerText = this.formatRupiah(subtotal);
    if (grandTotalEl) grandTotalEl.innerText = this.formatRupiah(grandTotal);

    return { subtotal, discount, grandTotal };
  }

  // Tangani scan barcode dari hardware atau kamera
  async onBarcodeReceived(barcode, sourceMode) {
    if (sourceMode === 'stock-input') {
      const input = document.getElementById('prod-barcode');
      if (input) input.value = barcode;
      this.showToast(`Barcode ${barcode} berhasil diisi!`, 'success');
      return;
    }

    // Default: Kasir POS
    await this.handleBarcodeSearch(barcode);
  }

  async handleBarcodeSearch(barcode) {
    const products = await dbGetAll('products');
    const matched = products.find(p => p.barcode && p.barcode.trim().toLowerCase() === barcode.trim().toLowerCase());

    if (matched) {
      await this.addToCart(matched.id, 1);
      this.showToast(`Ditambahkan: ${matched.name}`, 'success');
    } else {
      window.barcodeManager.playBeep(false);
      this.showToast(`Barcode "${barcode}" belum terdaftar di stokis!`, 'error');
      
      // Tawarkan untuk menambahkan produk jika belum ada
      if (confirm(`Barcode "${barcode}" belum terdaftar di stok barang. Buka form untuk menambahkan barang baru ini?`)) {
        this.openAddProductModal(barcode);
      }
    }
  }

  // =========================================================================
  // CHECKOUT & PEMBAYARAN KASIR
  // =========================================================================

  openPaymentModal() {
    if (this.cart.length === 0) return;
    const { grandTotal } = this.updateCartTotals();

    const totalEl = document.getElementById('modal-pay-total');
    if (totalEl) totalEl.innerText = this.formatRupiah(grandTotal);

    const cashInput = document.getElementById('modal-cash-input');
    if (cashInput) {
      cashInput.value = '';
    }
    this.calculateChange();

    // Pastikan metode pembayaran default / aktif disiapkan
    this.setPaymentMethod(this.paymentMethod || 'Tunai');

    this.showModal('payment-modal');

    setTimeout(() => {
      if (this.paymentMethod === 'Tunai' && cashInput) cashInput.focus();
    }, 150);
  }

  setPaymentMethod(method) {
    this.paymentMethod = method;
    const { grandTotal } = this.updateCartTotals();

    document.querySelectorAll('.pay-method-btn').forEach(b => {
      b.classList.remove('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
      b.classList.add('border-slate-200', 'text-slate-600');
    });

    const activeBtn = document.getElementById(`pay-method-${method.toLowerCase()}`);
    if (activeBtn) {
      activeBtn.classList.remove('border-slate-200', 'text-slate-600');
      activeBtn.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
    }

    const cashSection = document.getElementById('cash-payment-section');
    const qrisSection = document.getElementById('qris-payment-section');
    const transferSection = document.getElementById('transfer-payment-section');

    if (method === 'Tunai') {
      if (cashSection) cashSection.classList.remove('hidden');
      if (qrisSection) qrisSection.classList.add('hidden');
      if (transferSection) transferSection.classList.add('hidden');
    } else if (method === 'QRIS') {
      if (cashSection) cashSection.classList.add('hidden');
      if (transferSection) transferSection.classList.add('hidden');
      if (qrisSection) {
        qrisSection.classList.remove('hidden');

        // Render data QRIS
        const merchant = this.activeQrisInfo?.merchantName || this.activeStoreInfo?.storeName || 'Toko Aneka';
        const merchantEl = document.getElementById('modal-qris-merchant');
        if (merchantEl) merchantEl.innerText = merchant;

        const nmidEl = document.getElementById('modal-qris-nmid');
        if (nmidEl) {
          nmidEl.innerText = this.activeQrisInfo?.nmid ? `NMID: ${this.activeQrisInfo.nmid}` : '';
        }

        const amountEl = document.getElementById('modal-qris-amount');
        if (amountEl) amountEl.innerText = this.formatRupiah(grandTotal);

        const instEl = document.getElementById('modal-qris-instruction');
        if (instEl) {
          instEl.innerText = this.activeQrisInfo?.instruction || 'Buka aplikasi m-Banking atau e-Wallet favorit Anda, lalu scan barcode QRIS di atas.';
        }

        const qrImg = document.getElementById('modal-qris-image');
        const qrFallback = document.getElementById('modal-qris-fallback');
        if (this.activeQrisInfo?.qrImage) {
          if (qrImg) {
            qrImg.src = this.activeQrisInfo.qrImage;
            qrImg.classList.remove('hidden');
          }
          if (qrFallback) qrFallback.classList.add('hidden');
        } else {
          if (qrImg) qrImg.classList.add('hidden');
          if (qrFallback) qrFallback.classList.remove('hidden');
        }
      }
    } else if (method === 'Transfer') {
      if (cashSection) cashSection.classList.add('hidden');
      if (qrisSection) qrisSection.classList.add('hidden');
      if (transferSection) {
        transferSection.classList.remove('hidden');
        const storeNameEl = document.getElementById('transfer-store-name');
        if (storeNameEl) storeNameEl.innerText = this.activeStoreInfo?.storeName || 'Toko Aneka';
        const totalAmountEl = document.getElementById('transfer-total-amount');
        if (totalAmountEl) totalAmountEl.innerText = this.formatRupiah(grandTotal);
      }
    }

    this.calculateChange();
  }

  setExactCash() {
    const { grandTotal } = this.updateCartTotals();
    const cashInput = document.getElementById('modal-cash-input');
    if (cashInput) {
      cashInput.value = grandTotal;
      this.calculateChange();
    }
  }

  setQuickCash(amount) {
    const cashInput = document.getElementById('modal-cash-input');
    if (cashInput) {
      cashInput.value = amount;
      this.calculateChange();
    }
  }

  calculateChange() {
    const { grandTotal } = this.updateCartTotals();
    const cashInput = document.getElementById('modal-cash-input');
    const changeEl = document.getElementById('modal-change-amount');

    let cash = parseInt(cashInput?.value || 0, 10);
    if (this.paymentMethod !== 'Tunai') {
      cash = grandTotal;
    }

    const change = Math.max(0, cash - grandTotal);
    if (changeEl) {
      changeEl.innerText = this.formatRupiah(change);
    }
  }

  async processCheckout() {
    const { subtotal, discount, grandTotal } = this.updateCartTotals();
    const cashInput = document.getElementById('modal-cash-input');
    let cash = parseInt(cashInput?.value || 0, 10);

    if (this.paymentMethod !== 'Tunai') {
      cash = grandTotal;
    }

    if (cash < grandTotal) {
      this.showToast('Uang pembayaran kurang dari total tagihan!', 'error');
      window.barcodeManager.playBeep(false);
      return;
    }

    const change = cash - grandTotal;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const monthStr = `${year}-${month}`;
    const timeStr = now.toLocaleTimeString('id-ID');

    // Hitung total profit (laba kotor)
    let totalProfit = 0;
    const items = this.cart.map(item => {
      const itemProfit = (item.product.sellPrice - (item.product.buyPrice || 0)) * item.qty;
      totalProfit += itemProfit;
      return {
        productId: item.product.id,
        barcode: item.product.barcode || '',
        name: item.product.name,
        price: item.product.sellPrice,
        buyPrice: item.product.buyPrice || 0,
        qty: item.qty,
        subtotal: item.qty * item.product.sellPrice,
        profit: itemProfit,
        unit: item.product.unit || 'pcs'
      };
    });

    // Kurangi profit dengan diskon toko
    totalProfit = Math.max(0, totalProfit - discount);

    const invoiceNumber = `TRX-${year}${month}${day}-${Date.now().toString().slice(-4)}`;

    const transactionRecord = {
      id: 'trx-' + Date.now(),
      invoiceNumber: invoiceNumber,
      timestamp: now.getTime(),
      dateStr: dateStr,
      timeStr: timeStr,
      monthStr: monthStr,
      cashierName: window.authManager?.currentUser?.name || 'Kasir 1',
      cashierUsername: window.authManager?.currentUser?.username || 'kasir',
      items: items,
      subtotal: subtotal,
      discount: discount,
      total: grandTotal,
      cash: cash,
      change: change,
      profit: totalProfit,
      paymentMethod: this.paymentMethod
    };

    // 1. Simpan Transaksi ke IndexedDB
    await dbPut('transactions', transactionRecord);

    // 2. Kurangi Stok Barang di IndexedDB
    for (const item of this.cart) {
      const freshProduct = await dbGetById('products', item.product.id);
      if (freshProduct) {
        freshProduct.stock = Math.max(0, freshProduct.stock - item.qty);
        await dbPut('products', freshProduct);
      }
    }

    // 3. Tampilkan Struk Belanja
    this.renderReceipt(transactionRecord);

    // Tutup modal bayar & buka modal struk
    this.closeModal('payment-modal');
    this.showModal('receipt-modal');

    // Kosongkan keranjang & refresh stok
    this.clearCart();
    await this.renderPosProducts();
    await this.renderStockList();
    await this.updateLowStockBadge();

    this.showToast('Transaksi berhasil disimpan!', 'success');
  }

  // Render Struk Thermal
  renderReceipt(trx) {
    const area = document.getElementById('print-area');
    if (!area) return;

    const store = this.activeStoreInfo || {
      storeName: 'Toko Aneka',
      address: 'Jl. Melati No. 45',
      phone: '0812-9876-5432',
      receiptFooter: 'Terima kasih atas kunjungan Anda di Toko Aneka!'
    };

    let itemsHtml = trx.items.map(item => `
      <div class="mb-1">
        <div class="font-bold text-slate-900 leading-tight">${item.name}</div>
        <div class="flex justify-between text-[11px] text-slate-600 font-mono">
          <span>${item.qty} x ${this.formatRupiah(item.price)}</span>
          <span class="font-bold text-slate-900">${this.formatRupiah(item.subtotal)}</span>
        </div>
      </div>
    `).join('');

    area.innerHTML = `
      <div class="text-center mb-3">
        <h2 class="font-black text-base uppercase tracking-wider text-slate-900">${store.storeName}</h2>
        <p class="text-[10px] text-slate-500">${store.address || ''}</p>
        <p class="text-[10px] text-slate-500">Telp: ${store.phone || '-'}</p>
      </div>

      <div class="receipt-divider"></div>

      <div class="text-[10px] text-slate-600 mb-2 space-y-0.5">
        <div class="flex justify-between">
          <span>No: ${trx.invoiceNumber}</span>
          <span>${trx.timeStr}</span>
        </div>
        <div class="flex justify-between">
          <span>Tgl: ${trx.dateStr}</span>
          <span>Kasir: ${trx.cashierName || window.authManager?.currentUser?.name || 'Kasir 1'}</span>
        </div>
      </div>

      <div class="receipt-divider"></div>

      <div class="py-1">
        ${itemsHtml}
      </div>

      <div class="receipt-divider"></div>

      <div class="text-[11px] space-y-1 font-mono text-slate-800">
        <div class="flex justify-between">
          <span>Subtotal</span>
          <span>${this.formatRupiah(trx.subtotal || trx.total)}</span>
        </div>
        ${trx.discount > 0 ? `
          <div class="flex justify-between text-rose-600">
            <span>Diskon</span>
            <span>-${this.formatRupiah(trx.discount)}</span>
          </div>
        ` : ''}
        <div class="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
          <span>TOTAL</span>
          <span>${this.formatRupiah(trx.total)}</span>
        </div>
        <div class="flex justify-between">
          <span>Bayar (${trx.paymentMethod})</span>
          <span>${this.formatRupiah(trx.cash)}</span>
        </div>
        <div class="flex justify-between">
          <span>Kembalian</span>
          <span>${this.formatRupiah(trx.change)}</span>
        </div>
      </div>

      <div class="receipt-divider"></div>

      <div class="text-center mt-3 text-[10px] text-slate-500 whitespace-pre-line">
        ${store.receiptFooter}
      </div>
    `;
  }

  // =========================================================================
  // 2. STOKIS / INVENTARIS BARANG
  // =========================================================================

  async renderStockList() {
    const tableBody = document.getElementById('stock-table-body');
    const emptyState = document.getElementById('stock-empty');
    const categoryFilter = document.getElementById('stock-category-filter');
    const statusFilter = document.getElementById('stock-status-filter');
    const searchInput = document.getElementById('stock-search');

    if (!tableBody) return;

    const [products, categories] = await Promise.all([
      dbGetAll('products'),
      dbGetAll('categories')
    ]);

    // Update Dropdown Kategori di Filter Stok
    if (categoryFilter && categoryFilter.options.length <= 1) {
      categoryFilter.innerHTML = '<option value="all">Semua Kategori</option>' +
        categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    const keyword = (searchInput?.value || '').toLowerCase().trim();
    const selectedCategory = categoryFilter?.value || 'all';
    const selectedStatus = statusFilter?.value || 'all';

    const filtered = products.filter(p => {
      const matchKeyword = !keyword ||
        p.name.toLowerCase().includes(keyword) ||
        (p.barcode && p.barcode.toLowerCase().includes(keyword));
      const matchCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;

      let matchStatus = true;
      if (selectedStatus === 'low') {
        matchStatus = p.stock <= (p.minStock || 5);
      } else if (selectedStatus === 'safe') {
        matchStatus = p.stock > (p.minStock || 5);
      }

      return matchKeyword && matchCategory && matchStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const catMap = {};
    categories.forEach(c => catMap[c.id] = c);

    tableBody.innerHTML = filtered.map(p => {
      const cat = catMap[p.categoryId] || { name: 'Umum' };
      const isLow = p.stock <= (p.minStock || 5) && p.stock > 0;
      const isOut = p.stock <= 0;

      let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">Aman</span>`;
      if (isOut) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">Habis</span>`;
      } else if (isLow) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">Menipis (${p.stock})</span>`;
      }

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-3 px-4 font-mono text-xs font-semibold text-slate-700">
            <div class="flex items-center gap-1.5">
              <span>${p.barcode || '-'}</span>
              <button onclick="app.openBarcodeLabelModal('${p.id}')" title="Cetak Barcode Label"
                class="text-slate-400 hover:text-slate-800 p-1 rounded">
                <i class="fa-solid fa-barcode text-xs"></i>
              </button>
            </div>
          </td>
          <td class="py-3 px-4 font-semibold text-slate-800">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                ${p.image ? `<img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-box text-slate-400 text-xs"></i>`}
              </div>
              <span class="truncate max-w-xs">${p.name}</span>
            </div>
          </td>
          <td class="py-3 px-4">
            <span class="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
              ${cat.name}
            </span>
          </td>
          <td class="py-3 px-4 text-right font-mono text-slate-600">${this.formatRupiah(p.buyPrice)}</td>
          <td class="py-3 px-4 text-right font-mono font-bold text-emerald-600">${this.formatRupiah(p.sellPrice)}</td>
          <td class="py-3 px-4 text-center">
            <div class="inline-flex items-center gap-1">
              <span class="font-bold font-mono text-slate-800">${p.stock}</span>
              <span class="text-xs text-slate-400">${p.unit || ''}</span>
              <!-- Tombol Tambah Stok Cepat -->
              <button onclick="app.quickRestock('${p.id}')" title="Tambah Stok (+)"
                class="ml-1 text-xs text-emerald-600 hover:bg-emerald-50 w-5 h-5 rounded-md flex items-center justify-center border border-emerald-200">
                <i class="fa-solid fa-plus text-[10px]"></i>
              </button>
            </div>
          </td>
          <td class="py-3 px-4 text-center">${statusBadge}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="app.openEditProductModal('${p.id}')" title="Edit Barang"
                class="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                <i class="fa-solid fa-pen-to-square text-xs"></i>
              </button>
              <button onclick="app.confirmDeleteProduct('${p.id}')" title="Hapus Barang"
                class="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Quick Restock Produk
  async quickRestock(productId) {
    const product = await dbGetById('products', productId);
    if (!product) return;

    const addQtyStr = prompt(`Tambah jumlah stok untuk "${product.name}":\nStok saat ini: ${product.stock} ${product.unit}`, '10');
    if (!addQtyStr) return;

    const addQty = parseInt(addQtyStr, 10);
    if (isNaN(addQty) || addQty <= 0) {
      alert('Jumlah penambahan harus angka lebih dari 0');
      return;
    }

    product.stock += addQty;
    await dbPut('products', product);

    this.showToast(`Stok ${product.name} bertambah +${addQty}!`, 'success');
    await this.renderStockList();
    await this.renderPosProducts();
    await this.updateLowStockBadge();
  }

  // Buka Modal Tambah Produk Baru
  async openAddProductModal(prefillBarcode = '') {
    const form = document.getElementById('product-form');
    if (form) form.reset();

    document.getElementById('prod-id').value = '';
    document.getElementById('product-modal-title').innerText = 'Tambah Item Penjualan Baru';
    document.getElementById('btn-delete-prod').classList.add('hidden');

    // Reset foto produk
    this.setProductImagePreview('');

    if (prefillBarcode) {
      document.getElementById('prod-barcode').value = prefillBarcode;
    }

    // Isi dropdown kategori
    await this.populateCategoryDropdown();

    this.showModal('product-modal');
  }

  // Buka Modal Edit Produk
  async openEditProductModal(productId) {
    const product = await dbGetById('products', productId);
    if (!product) return;

    await this.populateCategoryDropdown();

    document.getElementById('prod-id').value = product.id;
    document.getElementById('prod-barcode').value = product.barcode || '';
    document.getElementById('prod-name').value = product.name || '';
    document.getElementById('prod-category').value = product.categoryId || '';
    document.getElementById('prod-unit').value = product.unit || 'Pcs';
    document.getElementById('prod-buy-price').value = product.buyPrice || 0;
    document.getElementById('prod-sell-price').value = product.sellPrice || 0;
    document.getElementById('prod-stock').value = product.stock || 0;
    document.getElementById('prod-min-stock').value = product.minStock || 5;

    // Muat foto produk jika ada
    this.setProductImagePreview(product.image || '');

    document.getElementById('product-modal-title').innerText = 'Edit Item Penjualan';
    document.getElementById('btn-delete-prod').classList.remove('hidden');

    this.showModal('product-modal');
  }

  // Helper tampilan preview foto produk
  setProductImagePreview(dataUrl) {
    const hiddenInput = document.getElementById('prod-image');
    const previewImg = document.getElementById('prod-image-preview');
    const placeholder = document.getElementById('prod-image-placeholder');
    const removeBtn = document.getElementById('btn-remove-prod-image');
    const fileInput = document.getElementById('prod-image-input');

    if (hiddenInput) hiddenInput.value = dataUrl || '';
    if (fileInput) fileInput.value = '';

    if (dataUrl) {
      if (previewImg) {
        previewImg.src = dataUrl;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.add('hidden');
    }
  }

  async handleProductImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Harap pilih file gambar (JPG, PNG, WebP)!', 'error');
      return;
    }

    try {
      this.showToast('Memproses gambar...', 'info');
      const compressed = await this.compressImageFile(file, 400, 400, 0.82);
      this.setProductImagePreview(compressed);
      this.showToast('Foto produk berhasil diunggah!', 'success');
    } catch (err) {
      console.error('Error saat kompresi foto produk:', err);
      this.showToast('Gagal memproses gambar.', 'error');
    }
  }

  removeProductImage() {
    this.setProductImagePreview('');
  }

  async populateCategoryDropdown() {
    const select = document.getElementById('prod-category');
    if (!select) return;
    const categories = await dbGetAll('categories');
    select.innerHTML = categories.map(c => `
      <option value="${c.id}">${c.name}</option>
    `).join('');
  }

  // Simpan Produk (Tambah / Edit)
  async saveProduct(e) {
    e.preventDefault();

    const id = document.getElementById('prod-id').value || ('prd-' + Date.now());
    const barcode = document.getElementById('prod-barcode').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const categoryId = document.getElementById('prod-category').value;
    const unit = document.getElementById('prod-unit').value.trim() || 'Pcs';
    const buyPrice = parseInt(document.getElementById('prod-buy-price').value, 10) || 0;
    const sellPrice = parseInt(document.getElementById('prod-sell-price').value, 10) || 0;
    const stock = parseInt(document.getElementById('prod-stock').value, 10) || 0;
    const minStock = parseInt(document.getElementById('prod-min-stock').value, 10) || 5;
    const image = document.getElementById('prod-image')?.value || '';

    const productData = {
      id,
      barcode,
      name,
      image,
      categoryId,
      unit,
      buyPrice,
      sellPrice,
      stock,
      minStock
    };

    await dbPut('products', productData);

    this.closeModal('product-modal');
    this.showToast(`Produk "${name}" berhasil disimpan!`, 'success');

    await this.renderStockList();
    await this.renderPosProducts();
    await this.updateLowStockBadge();
  }

  // Konfirmasi Hapus Produk
  async confirmDeleteProduct(productId) {
    const product = await dbGetById('products', productId);
    if (!product) return;

    if (confirm(`Apakah Anda yakin ingin menghapus produk "${product.name}"?`)) {
      await dbDelete('products', productId);
      this.showToast(`Produk "${product.name}" telah dihapus`, 'info');
      await this.renderStockList();
      await this.renderPosProducts();
      await this.updateLowStockBadge();
    }
  }

  async deleteProduct() {
    const id = document.getElementById('prod-id').value;
    if (id) {
      await this.confirmDeleteProduct(id);
      this.closeModal('product-modal');
    }
  }

  // Buat Barcode Baru Otomatis (EAN-13 format)
  generateRandomBarcode() {
    // Generate 12 digit acak berawalan 899 (kode GS1 Indonesia)
    let code = '899';
    for (let i = 0; i < 9; i++) {
      code += Math.floor(Math.random() * 10);
    }
    // Hitung checksum EAN-13
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const fullBarcode = code + checkDigit;

    document.getElementById('prod-barcode').value = fullBarcode;
    this.showToast('Barcode otomatis berhasil digenerate!', 'success');
  }

  // Buka Modal Cetak Barcode Label
  async openBarcodeLabelModal(productId) {
    const product = await dbGetById('products', productId);
    if (!product || !product.barcode) {
      alert('Produk ini belum memiliki nomor barcode.');
      return;
    }

    document.getElementById('label-prod-name').innerText = product.name;
    document.getElementById('label-prod-price').innerText = this.formatRupiah(product.sellPrice);

    // Render SVG Barcode menggunakan JsBarcode
    try {
      JsBarcode('#barcode-svg', product.barcode, {
        format: 'CODE128',
        width: 1.8,
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 5
      });
    } catch (e) {
      console.warn('JsBarcode error, coba default:', e);
      JsBarcode('#barcode-svg', product.barcode);
    }

    this.showModal('barcode-print-modal');
  }

  printBarcodeLabelOnly() {
    const sticker = document.getElementById('barcode-sticker-preview');
    if (!sticker) return;

    const printWindow = window.open('', '', 'width=400,height=300');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Label Barcode</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; margin: 0; padding: 10px; }
            .label-box { text-align: center; border: 1px dashed #ccc; padding: 8px; border-radius: 6px; }
            .name { font-size: 11px; font-weight: bold; margin-bottom: 2px; }
            .price { font-size: 13px; font-weight: bold; margin-top: 2px; }
            svg { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <div class="label-box">
            ${sticker.innerHTML}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  // Update badge jumlah produk yang stoknya menipis
  async updateLowStockBadge() {
    const products = await dbGetAll('products');
    const lowCount = products.filter(p => p.stock <= (p.minStock || 5)).length;

    const badge = document.getElementById('badge-low-stock');
    if (badge) {
      if (lowCount > 0) {
        badge.innerText = lowCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  // =========================================================================
  // 3. MANAJEMEN KATEGORI PRODUK
  // =========================================================================

  async renderCategories() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    const [categories, products] = await Promise.all([
      dbGetAll('categories'),
      dbGetAll('products')
    ]);

    // Hitung produk per kategori
    const countMap = {};
    products.forEach(p => {
      countMap[p.categoryId] = (countMap[p.categoryId] || 0) + 1;
    });

    grid.innerHTML = categories.map(c => {
      const pCount = countMap[c.id] || 0;
      return `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-500 transition">
          <div>
            <div class="flex items-center justify-between mb-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style="background-color: ${c.color || '#16a34a'}">
                <i class="fa-solid ${c.icon || 'fa-tag'} text-base"></i>
              </div>
              <div class="flex items-center gap-1">
                <button onclick="app.openEditCategoryModal('${c.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
                <button onclick="app.confirmDeleteCategory('${c.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            </div>
            <h4 class="font-bold text-slate-800 text-sm mb-1">${c.name}</h4>
            <span class="text-xs text-slate-500 font-medium">${pCount} Produk Terdaftar</span>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button onclick="app.viewProductsInCategory('${c.id}')" class="text-xs font-semibold text-emerald-600 hover:underline">
              Lihat di Stokis &rarr;
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  viewProductsInCategory(catId) {
    this.switchView('stock');
    const catFilter = document.getElementById('stock-category-filter');
    if (catFilter) {
      catFilter.value = catId;
      this.renderStockList();
    }
  }

  openCategoryModal() {
    const form = document.getElementById('category-form');
    if (form) form.reset();

    document.getElementById('cat-id').value = '';
    document.getElementById('category-modal-title').innerText = 'Tambah Kategori Baru';
    this.showModal('category-modal');
  }

  async openEditCategoryModal(catId) {
    const cat = await dbGetById('categories', catId);
    if (!cat) return;

    document.getElementById('cat-id').value = cat.id;
    document.getElementById('cat-name').value = cat.name || '';
    document.getElementById('cat-icon').value = cat.icon || 'fa-wheat-awn';
    document.getElementById('cat-color').value = cat.color || '#16a34a';

    document.getElementById('category-modal-title').innerText = 'Edit Kategori';
    this.showModal('category-modal');
  }

  async saveCategory(e) {
    e.preventDefault();

    const id = document.getElementById('cat-id').value || ('cat-' + Date.now());
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value;
    const color = document.getElementById('cat-color').value;

    const catData = { id, name, icon, color };
    await dbPut('categories', catData);

    this.closeModal('category-modal');
    this.showToast(`Kategori "${name}" berhasil disimpan!`, 'success');

    await this.renderCategories();
    await this.renderPosCategories();
    await this.renderStockList();
  }

  async confirmDeleteCategory(catId) {
    const cat = await dbGetById('categories', catId);
    if (!cat) return;

    const products = await dbGetAll('products');
    const linked = products.filter(p => p.categoryId === catId);
    if (linked.length > 0) {
      alert(`Tidak dapat menghapus kategori "${cat.name}" karena masih ada ${linked.length} produk di dalamnya.`);
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus kategori "${cat.name}"?`)) {
      await dbDelete('categories', catId);
      this.showToast(`Kategori "${cat.name}" telah dihapus`, 'info');
      await this.renderCategories();
      await this.renderPosCategories();
      await this.renderStockList();
    }
  }

  // =========================================================================
  // 4. PENCATATAN & LAPORAN TRANSAKSI HARIAN
  // =========================================================================

  setTodayDate() {
    const picker = document.getElementById('daily-date-picker');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (picker) {
      picker.value = todayStr;
      this.loadDailyTransactions();
    }
  }

  async loadDailyTransactions() {
    const picker = document.getElementById('daily-date-picker');
    const dateStr = picker?.value;
    if (!dateStr) return;

    const transactions = await dbGetTransactionsByDate(dateStr);
    const tableBody = document.getElementById('daily-trx-table-body');
    const emptyState = document.getElementById('daily-trx-empty');
    const badgeCount = document.getElementById('daily-trx-count-badge');

    if (badgeCount) badgeCount.innerText = `${transactions.length} Transaksi`;

    // Hitung Metrik Harian
    let totalOmzet = 0;
    let totalProfit = 0;
    transactions.forEach(t => {
      totalOmzet += (t.total || 0);
      totalProfit += (t.profit || 0);
    });

    const avgTransaction = transactions.length > 0 ? Math.round(totalOmzet / transactions.length) : 0;

    const omzetEl = document.getElementById('daily-total-omzet');
    const profitEl = document.getElementById('daily-total-profit');
    const countEl = document.getElementById('daily-total-count');
    const avgEl = document.getElementById('daily-avg-transaction');

    if (omzetEl) omzetEl.innerText = this.formatRupiah(totalOmzet);
    if (profitEl) profitEl.innerText = this.formatRupiah(totalProfit);
    if (countEl) countEl.innerText = transactions.length;
    if (avgEl) avgEl.innerText = this.formatRupiah(avgTransaction);

    if (!tableBody) return;

    if (transactions.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Urutkan dari transaksi terbaru
    transactions.sort((a, b) => b.timestamp - a.timestamp);

    tableBody.innerHTML = transactions.map(t => {
      const itemsSummary = t.items.map(i => `${i.name} (${i.qty})`).join(', ');
      const isCashier = window.authManager && !window.authManager.isAdmin();

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-mono font-bold text-xs text-slate-800">${t.invoiceNumber}</td>
          <td class="py-3 px-4 text-xs font-mono text-slate-500">${t.timeStr || '-'}</td>
          <td class="py-3 px-4 text-xs font-semibold text-slate-700">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
              <i class="fa-solid fa-user-tag text-[10px] text-slate-400"></i>
              ${t.cashierName || 'Kasir 1'}
            </span>
          </td>
          <td class="py-3 px-4 text-xs text-slate-700 max-w-xs truncate" title="${itemsSummary}">${itemsSummary}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.paymentMethod === 'Tunai' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
              ${t.paymentMethod}
            </span>
          </td>
          <td class="py-3 px-4 text-right font-mono text-xs text-blue-600 font-semibold admin-profit-field ${isCashier ? 'hidden' : ''}">${this.formatRupiah(t.profit)}</td>
          <td class="py-3 px-4 text-right font-mono font-bold text-xs text-slate-900">${this.formatRupiah(t.total)}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="app.viewReprintReceipt('${t.id}')" title="Lihat / Cetak Struk"
              class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 mx-auto">
              <i class="fa-solid fa-print"></i> Struk
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async viewReprintReceipt(trxId) {
    const trx = await dbGetById('transactions', trxId);
    if (!trx) return;
    this.renderReceipt(trx);
    this.showModal('receipt-modal');
  }

  async exportDailyCSV() {
    const dateStr = document.getElementById('daily-date-picker')?.value;
    if (!dateStr) return;

    const transactions = await dbGetTransactionsByDate(dateStr);
    if (transactions.length === 0) {
      alert('Tidak ada data transaksi pada tanggal ini untuk diekspor.');
      return;
    }

    const isAdmin = window.authManager ? window.authManager.isAdmin() : true;
    let csvContent = isAdmin
      ? 'No Struk,Waktu,Kasir,Metode Pembayaran,Item Belanja,Subtotal,Diskon,Total,Laba Kotor\r\n'
      : 'No Struk,Waktu,Kasir,Metode Pembayaran,Item Belanja,Subtotal,Diskon,Total\r\n';

    transactions.forEach(t => {
      const itemsStr = t.items.map(i => `${i.name} [${i.qty}x]`).join('; ').replace(/"/g, '""');
      const cashierStr = (t.cashierName || 'Kasir 1').replace(/"/g, '""');
      if (isAdmin) {
        csvContent += `"${t.invoiceNumber}","${t.timeStr}","${cashierStr}","${t.paymentMethod}","${itemsStr}",${t.subtotal || t.total},${t.discount || 0},${t.total},${t.profit || 0}\r\n`;
      } else {
        csvContent += `"${t.invoiceNumber}","${t.timeStr}","${cashierStr}","${t.paymentMethod}","${itemsStr}",${t.subtotal || t.total},${t.discount || 0},${t.total}\r\n`;
      }
    });

    this.downloadCSV(csvContent, `Laporan-Harian-Toko-Aneka-${dateStr}.csv`);
  }

  // =========================================================================
  // 5. PENCATATAN & LAPORAN TRANSAKSI BULANAN
  // =========================================================================

  setCurrentMonth() {
    const picker = document.getElementById('monthly-picker');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonthStr = `${year}-${month}`;

    if (picker) {
      picker.value = currentMonthStr;
      this.loadMonthlyTransactions();
    }
  }

  async loadMonthlyTransactions() {
    const picker = document.getElementById('monthly-picker');
    const monthStr = picker?.value;
    if (!monthStr) return;

    const transactions = await dbGetTransactionsByMonth(monthStr);

    let monthlyTotalOmzet = 0;
    let monthlyTotalProfit = 0;
    const dailyMap = {};

    transactions.forEach(t => {
      monthlyTotalOmzet += (t.total || 0);
      monthlyTotalProfit += (t.profit || 0);

      const d = t.dateStr;
      if (!dailyMap[d]) {
        dailyMap[d] = { count: 0, omzet: 0, profit: 0 };
      }
      dailyMap[d].count += 1;
      dailyMap[d].omzet += (t.total || 0);
      dailyMap[d].profit += (t.profit || 0);
    });

    const activeDaysCount = Object.keys(dailyMap).length;
    const avgDailyOmzet = activeDaysCount > 0 ? Math.round(monthlyTotalOmzet / activeDaysCount) : 0;
    const marginRate = monthlyTotalOmzet > 0 ? ((monthlyTotalProfit / monthlyTotalOmzet) * 100).toFixed(1) : 0;

    // Tampilkan metrik bulanan
    const mOmzet = document.getElementById('monthly-total-omzet');
    const mProfit = document.getElementById('monthly-total-profit');
    const mAvg = document.getElementById('monthly-avg-daily');
    const mCount = document.getElementById('monthly-trx-count');
    const mMargin = document.getElementById('monthly-margin-rate');

    if (mOmzet) mOmzet.innerText = this.formatRupiah(monthlyTotalOmzet);
    if (mProfit) mProfit.innerText = this.formatRupiah(monthlyTotalProfit);
    if (mAvg) mAvg.innerText = this.formatRupiah(avgDailyOmzet);
    if (mCount) mCount.innerText = `${transactions.length} transaksi total di ${activeDaysCount} hari aktif`;
    if (mMargin) mMargin.innerText = `Margin keuntungan rata-rata: ${marginRate}%`;

    // Render Chart Bulanan (Chart.js)
    this.renderMonthlyChart(monthStr, dailyMap);

    // Render Tabel Rincian per Tanggal
    const tbody = document.getElementById('monthly-breakdown-body');
    if (!tbody) return;

    const sortedDates = Object.keys(dailyMap).sort().reverse();
    if (sortedDates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">Belum ada data transaksi di bulan ${monthStr}</td></tr>`;
      return;
    }

    tbody.innerHTML = sortedDates.map(date => {
      const data = dailyMap[date];
      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-mono font-semibold text-slate-800">${date}</td>
          <td class="py-3 px-4 text-center font-mono text-slate-700">${data.count} Transaksi</td>
          <td class="py-3 px-4 text-right font-mono font-bold text-emerald-600">${this.formatRupiah(data.omzet)}</td>
          <td class="py-3 px-4 text-right font-mono text-blue-600 font-semibold">${this.formatRupiah(data.profit)}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="app.viewSpecificDay('${date}')" class="text-xs text-emerald-600 hover:underline font-semibold">
              Buka Harian &rarr;
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  viewSpecificDay(dateStr) {
    this.switchView('daily');
    const picker = document.getElementById('daily-date-picker');
    if (picker) {
      picker.value = dateStr;
      this.loadDailyTransactions();
    }
  }

  renderMonthlyChart(monthStr, dailyMap) {
    const canvas = document.getElementById('monthly-sales-chart');
    if (!canvas) return;

    const [year, month] = monthStr.split('-').map(n => parseInt(n, 10));
    const daysInMonth = new Date(year, month, 0).getDate();

    const labels = [];
    const omzetData = [];
    const profitData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${dayStr}`;
      labels.push(`Tgl ${day}`);
      omzetData.push(dailyMap[dateKey] ? dailyMap[dateKey].omzet : 0);
      profitData.push(dailyMap[dateKey] ? dailyMap[dateKey].profit : 0);
    }

    if (this.monthlyChart) {
      this.monthlyChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Omzet Penjualan (Rp)',
            data: omzetData,
            backgroundColor: '#10b981',
            borderRadius: 4,
          },
          {
            label: 'Laba Kotor / Profit (Rp)',
            data: profitData,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { size: 11, family: 'Plus Jakarta Sans' } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: ${app.formatRupiah(context.raw)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => {
                if (val >= 1000000) return (val / 1000000) + ' Jt';
                if (val >= 1000) return (val / 1000) + ' Rb';
                return val;
              }
            }
          }
        }
      }
    });
  }

  async exportMonthlyCSV() {
    const monthStr = document.getElementById('monthly-picker')?.value;
    if (!monthStr) return;

    const transactions = await dbGetTransactionsByMonth(monthStr);
    if (transactions.length === 0) {
      alert('Tidak ada transaksi di bulan ini untuk diekspor.');
      return;
    }

    let csvContent = 'Tanggal,No Struk,Waktu,Metode,Total Omzet,Laba Kotor\r\n';
    transactions.forEach(t => {
      csvContent += `"${t.dateStr}","${t.invoiceNumber}","${t.timeStr}","${t.paymentMethod}",${t.total},${t.profit || 0}\r\n`;
    });

    this.downloadCSV(csvContent, `Rekap-Bulanan-Toko-Aneka-${monthStr}.csv`);
  }

  // =========================================================================
  // 6. PENGATURAN TOKO & BACKUP DATABASE
  // =========================================================================

  async saveStoreSettings(e) {
    e.preventDefault();

    const storeName = document.getElementById('setting-store-name').value.trim() || 'Toko Aneka';
    const phone = document.getElementById('setting-phone').value.trim();
    const address = document.getElementById('setting-address').value.trim();
    const receiptFooter = document.getElementById('setting-footer').value.trim();

    const newSetting = {
      key: 'storeInfo',
      storeName,
      phone,
      address,
      receiptFooter
    };

    await dbPut('settings', newSetting);
    this.activeStoreInfo = newSetting;

    const sidebarName = document.getElementById('sidebar-store-name');
    if (sidebarName) sidebarName.innerText = storeName;

    this.showToast('Pengaturan toko berhasil disimpan!', 'success');
  }

  // =========================================================================
  // PENGATURAN QRIS
  // =========================================================================

  setQrisImagePreview(dataUrl) {
    const hiddenInput = document.getElementById('setting-qris-image');
    const previewImg = document.getElementById('setting-qris-preview');
    const placeholder = document.getElementById('setting-qris-placeholder');
    const removeBtn = document.getElementById('btn-remove-qris-img');
    const fileInput = document.getElementById('setting-qris-file');

    if (hiddenInput) hiddenInput.value = dataUrl || '';
    if (fileInput) fileInput.value = '';

    if (dataUrl) {
      if (previewImg) {
        previewImg.src = dataUrl;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.add('hidden');
    }
  }

  async handleQrisImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Harap pilih file gambar QRIS!', 'error');
      return;
    }

    try {
      this.showToast('Memproses gambar QRIS...', 'info');
      const compressed = await this.compressImageFile(file, 600, 600, 0.85);
      this.setQrisImagePreview(compressed);
      this.showToast('Gambar QRIS siap disimpan!', 'success');
    } catch (err) {
      console.error('Error saat kompresi gambar QRIS:', err);
      this.showToast('Gagal memproses gambar QRIS.', 'error');
    }
  }

  removeQrisImage() {
    this.setQrisImagePreview('');
  }

  async saveQrisSettings(e) {
    e.preventDefault();
    const enabled = document.getElementById('setting-qris-enabled')?.checked ?? true;
    const merchantName = document.getElementById('setting-qris-merchant')?.value.trim() || 'Toko Aneka';
    const nmid = document.getElementById('setting-qris-nmid')?.value.trim() || '';
    const instruction = document.getElementById('setting-qris-instruction')?.value.trim() || '';
    const qrImage = document.getElementById('setting-qris-image')?.value || '';

    const newSetting = {
      key: 'qrisInfo',
      enabled,
      merchantName,
      nmid,
      instruction,
      qrImage
    };

    await dbPut('settings', newSetting);
    this.activeQrisInfo = newSetting;
    this.showToast('Pengaturan pembayaran QRIS berhasil disimpan!', 'success');
  }

  async backupDatabase() {
    const [categories, products, transactions, settings, users] = await Promise.all([
      dbGetAll('categories'),
      dbGetAll('products'),
      dbGetAll('transactions'),
      dbGetAll('settings'),
      dbGetAll('users')
    ]);

    const backupData = {
      appName: 'Toko Aneka POS',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      data: {
        categories,
        products,
        transactions,
        settings,
        users
      }
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup-Toko-Aneka-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast('Cadangan database berhasil diunduh!', 'success');
  }

  async restoreDatabase(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.data || !parsed.data.products) {
          throw new Error('Format file backup tidak sesuai!');
        }

        if (confirm('PERINGATAN: Memulihkan cadangan akan menggantikan data toko saat ini. Lanjutkan?')) {
          await dbClear('categories');
          await dbClear('products');
          await dbClear('transactions');
          await dbClear('settings');

          for (const c of (parsed.data.categories || [])) await dbPut('categories', c);
          for (const p of (parsed.data.products || [])) await dbPut('products', p);
          for (const t of (parsed.data.transactions || [])) await dbPut('transactions', t);
          for (const s of (parsed.data.settings || [])) await dbPut('settings', s);

          if (parsed.data.users && Array.isArray(parsed.data.users)) {
            await dbClear('users');
            for (const u of parsed.data.users) await dbPut('users', u);
          }

          await this.loadStoreSettings();
          await this.refreshAllData();
          await this.renderUsersList();
          this.showToast('Data toko berhasil dipulihkan!', 'success');
        }
      } catch (err) {
        alert('Gagal membaca file cadangan: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async confirmResetData() {
    if (confirm('Kembalikan semua produk, kategori, transaksi, dan akun ke data sampel bawaan?')) {
      await dbClear('categories');
      await dbClear('products');
      await dbClear('transactions');
      await dbClear('settings');
      await dbClear('users');
      await initSeedData();
      await this.loadStoreSettings();
      await this.refreshAllData();
      await this.renderUsersList();
      this.showToast('Data berhasil direset ke data sampel!', 'success');
    }
  }

  // =========================================================================
  // 7. MANAJEMEN PENGGUNA & KASIR (KHUSUS ADMIN)
  // =========================================================================

  async renderUsersList() {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return;

    try {
      const users = await dbGetAll('users');
      if (users.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center py-6 text-slate-400">Belum ada akun pengguna.</td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = users.map(u => {
        const isAdmin = u.role === 'admin';
        const roleBadge = isAdmin
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200"><i class="fa-solid fa-user-shield mr-1"></i>ADMIN</span>'
          : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><i class="fa-solid fa-user-tag mr-1"></i>KASIR</span>';
        
        const isDefaultAdmin = u.username === 'admin';
        const isCurrentActive = window.authManager && window.authManager.currentUser && window.authManager.currentUser.username === u.username;
        const formattedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

        let actionHtml = '';
        if (isDefaultAdmin) {
          actionHtml = '<span class="text-[11px] text-slate-400 italic">Akun Utama</span>';
        } else if (isCurrentActive) {
          actionHtml = '<span class="text-[11px] text-emerald-600 font-semibold italic">Sedang Aktif</span>';
        } else {
          actionHtml = `
            <button onclick="app.deleteUser('${u.id}', '${u.username}')" class="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition flex items-center gap-1 mx-auto">
              <i class="fa-solid fa-trash-can"></i> Hapus
            </button>
          `;
        }

        return `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg ${isAdmin ? 'bg-blue-600' : 'bg-emerald-600'} text-white flex items-center justify-center text-xs">
                <i class="fa-solid ${isAdmin ? 'fa-user-shield' : 'fa-user-tag'}"></i>
              </div>
              <span>${u.name}</span>
            </td>
            <td class="py-3 px-4 font-mono text-slate-600 font-bold">${u.username}</td>
            <td class="py-3 px-4">${roleBadge}</td>
            <td class="py-3 px-4 text-slate-500">${formattedDate}</td>
            <td class="py-3 px-4 text-center">${actionHtml}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error saat memuat daftar pengguna:', err);
    }
  }

  openUserModal() {
    const form = document.getElementById('user-form');
    if (form) form.reset();
    const idEl = document.getElementById('user-id');
    if (idEl) idEl.value = '';
    const titleEl = document.getElementById('user-modal-title');
    if (titleEl) titleEl.innerText = 'Tambah Pengguna Baru';
    this.showModal('user-modal');
  }

  async saveUser(e) {
    e.preventDefault();
    const id = document.getElementById('user-id')?.value;
    const name = document.getElementById('user-fullname')?.value.trim();
    const username = document.getElementById('user-username')?.value.trim().toLowerCase();
    const password = document.getElementById('user-password')?.value.trim();
    const role = document.getElementById('user-role')?.value || 'kasir';

    if (!name || !username || !password) {
      this.showToast('Semua kolom wajib diisi!', 'error');
      return;
    }

    try {
      // Cek apakah username sudah dipakai
      const existing = await dbGetUserByUsername(username);
      if (existing && (!id || existing.id !== id)) {
        this.showToast(`Username "${username}" sudah digunakan! Silakan gunakan username lain.`, 'error');
        return;
      }

      const userId = id || ('usr-' + Date.now());
      const newUser = {
        id: userId,
        name,
        username,
        password,
        role,
        avatarIcon: role === 'admin' ? 'fa-user-shield' : 'fa-user-tag',
        createdAt: new Date().toISOString()
      };

      await dbPut('users', newUser);
      this.closeModal('user-modal');
      await this.renderUsersList();
      this.showToast(`Akun ${role === 'admin' ? 'Admin' : 'Kasir'} "${name}" berhasil disimpan!`, 'success');
    } catch (err) {
      console.error('Gagal menyimpan pengguna:', err);
      this.showToast('Terjadi kesalahan saat menyimpan akun.', 'error');
    }
  }

  async deleteUser(userId, username) {
    if (username === 'admin') {
      this.showToast('Akun default admin tidak dapat dihapus!', 'error');
      return;
    }

    if (window.authManager && window.authManager.currentUser && window.authManager.currentUser.username === username) {
      this.showToast('Anda tidak dapat menghapus akun yang sedang Anda gunakan!', 'error');
      return;
    }

    if (confirm(`Apakah Anda yakin ingin menghapus akun pengguna "${username}"?`)) {
      try {
        await dbDelete('users', userId);
        await this.renderUsersList();
        this.showToast(`Akun "${username}" berhasil dihapus.`, 'info');
      } catch (err) {
        console.error('Error saat menghapus pengguna:', err);
        this.showToast('Gagal menghapus pengguna.', 'error');
      }
    }
  }

  // =========================================================================
  // UTILITIES & HELPER
  // =========================================================================

  formatRupiah(number) {
    return 'Rp ' + Number(number || 0).toLocaleString('id-ID');
  }

  // Kompresi Gambar di sisi Client menggunakan HTML Canvas
  compressImageFile(file, maxWidth = 500, maxHeight = 500, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  downloadCSV(content, filename) {
    const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(`Laporan "${filename}" berhasil diunduh!`, 'success');
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastMsg) return;

    toastMsg.innerText = message;

    if (type === 'success') {
      toastIcon.className = 'fa-solid fa-circle-check text-emerald-400 text-base';
    } else if (type === 'error') {
      toastIcon.className = 'fa-solid fa-circle-xmark text-rose-400 text-base';
    } else {
      toastIcon.className = 'fa-solid fa-circle-info text-blue-400 text-base';
    }

    toast.classList.remove('hidden');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }
}

// Inisialisasi Aplikasi Toko Aneka
window.app = new TokoAnekaApp();
