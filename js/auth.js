/**
 * Toko Aneka - Authentication & Session Manager
 * Mengatur login, logout, hak akses (RBAC) Kasir vs Admin, dan persistensi sesi.
 */

class AuthManager {
  constructor() {
    this.STORAGE_KEY = 'toko_aneka_auth_session';
    this.currentUser = null;
    this.currentRoleTab = 'kasir'; // 'kasir' | 'admin'
  }

  // Inisialisasi pengecekan sesi saat aplikasi dibuka
  async init() {
    const sessionData = this.getStoredSession();
    if (sessionData && sessionData.username) {
      try {
        const user = await dbGetUserByUsername(sessionData.username);
        if (user) {
          this.currentUser = user;
          this.hideLoginScreen();
          this.applyRoleRestrictions();
          return true;
        }
      } catch (err) {
        console.warn('Gagal memulihkan sesi pengguna:', err);
      }
    }

    // Jika belum login, tampilkan layar login
    this.showLoginScreen();
    return false;
  }

  // Ambil data sesi dari localStorage atau sessionStorage
  getStoredSession() {
    try {
      const local = localStorage.getItem(this.STORAGE_KEY);
      if (local) return JSON.parse(local);
      const session = sessionStorage.getItem(this.STORAGE_KEY);
      if (session) return JSON.parse(session);
    } catch (e) {
      console.error('Error membaca sesi:', e);
    }
    return null;
  }

  // Simpan data sesi
  saveSession(user, rememberMe = true) {
    const data = JSON.stringify({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      loginAt: new Date().toISOString()
    });

    if (rememberMe) {
      localStorage.setItem(this.STORAGE_KEY, data);
      sessionStorage.removeItem(this.STORAGE_KEY);
    } else {
      sessionStorage.setItem(this.STORAGE_KEY, data);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  // Bersihkan sesi
  clearSession() {
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.currentUser = null;
  }

  // Proses Autentikasi Login
  async login(username, password, rememberMe = true) {
    const errorAlert = document.getElementById('login-error-alert');
    const errorText = document.getElementById('login-error-text');

    if (errorAlert) errorAlert.classList.add('hidden');

    if (!username || !password) {
      this.showLoginError('Harap isi username dan password!');
      return false;
    }

    try {
      const user = await dbGetUserByUsername(username.trim());
      if (!user) {
        this.showLoginError('Username tidak ditemukan!');
        return false;
      }

      if (user.password !== password) {
        this.showLoginError('Password yang Anda masukkan salah!');
        return false;
      }

      // Berhasil login
      this.currentUser = user;
      this.saveSession(user, rememberMe);
      this.hideLoginScreen();
      this.applyRoleRestrictions();

      // Sambutan notifikasi
      const roleLabel = user.role === 'admin' ? 'Administrator' : 'Kasir';
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast(`Selamat bertugas, ${user.name}! (${roleLabel})`, 'success');
      }

      // Reset form input login
      const userInput = document.getElementById('login-username');
      const passInput = document.getElementById('login-password');
      if (userInput) userInput.value = '';
      if (passInput) passInput.value = '';

      // Tampilkan view awal yang sesuai
      if (window.app) {
        window.app.switchView('pos');
        if (typeof window.app.renderStockList === 'function' && user.role === 'admin') {
          window.app.renderStockList();
        }
      }

      return true;
    } catch (err) {
      console.error('Error saat login:', err);
      this.showLoginError('Terjadi kesalahan sistem saat mencoba masuk.');
      return false;
    }
  }

  // Logout
  logout() {
    const userName = this.currentUser ? this.currentUser.name : 'Pengguna';
    this.clearSession();
    this.showLoginScreen();

    // Reset view ke POS untuk persiapan login berikutnya
    if (window.app) {
      const views = ['pos', 'stock', 'categories', 'daily', 'monthly', 'settings'];
      views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');
      });
      window.app.showToast(`Sampai jumpa, ${userName}! Anda telah keluar.`, 'info');
    }
  }

  // Tampilkan pesan error pada halaman login
  showLoginError(message) {
    const errorAlert = document.getElementById('login-error-alert');
    const errorText = document.getElementById('login-error-text');
    if (errorAlert && errorText) {
      errorText.innerText = message;
      errorAlert.classList.remove('hidden');
    } else {
      alert(message);
    }
  }

  // Tampilkan layar login
  showLoginScreen() {
    const screen = document.getElementById('login-screen');
    if (screen) {
      screen.classList.remove('hidden');
      setTimeout(() => {
        const userInput = document.getElementById('login-username');
        if (userInput) userInput.focus();
      }, 100);
    }
  }

  // Sembunyikan layar login
  hideLoginScreen() {
    const screen = document.getElementById('login-screen');
    if (screen) {
      screen.classList.add('hidden');
    }
  }

  // Helper Cek Role
  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }

  isCashier() {
    return this.currentUser && this.currentUser.role === 'kasir';
  }

  // Hak akses navigasi
  canAccess(viewName) {
    if (!this.currentUser) return false;
    if (this.isAdmin()) return true;

    // Hak akses Kasir: Hanya POS dan Transaksi Harian
    const allowedForCashier = ['pos', 'daily'];
    return allowedForCashier.includes(viewName);
  }

  // Switch Tab Login (Admin / Kasir)
  setRoleTab(role) {
    this.currentRoleTab = role;
    const tabKasir = document.getElementById('tab-role-kasir');
    const tabAdmin = document.getElementById('tab-role-admin');
    const roleBadge = document.getElementById('login-role-badge');
    const userInput = document.getElementById('login-username');
    const passInput = document.getElementById('login-password');

    if (role === 'kasir') {
      if (tabKasir) {
        tabKasir.className = 'flex-1 py-2.5 text-xs font-bold rounded-xl transition shadow-sm bg-emerald-600 text-white flex items-center justify-center gap-2';
      }
      if (tabAdmin) {
        tabAdmin.className = 'flex-1 py-2.5 text-xs font-bold rounded-xl transition text-slate-400 hover:text-white flex items-center justify-center gap-2';
      }
      if (roleBadge) {
        roleBadge.className = 'px-2.5 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 inline-flex items-center gap-1.5';
        roleBadge.innerHTML = '<i class="fa-solid fa-cash-register"></i> Masuk Sebagai Kasir';
      }
      if (userInput && !userInput.value) userInput.value = 'kasir';
      if (passInput && !passInput.value) passInput.value = 'kasir123';
    } else {
      if (tabAdmin) {
        tabAdmin.className = 'flex-1 py-2.5 text-xs font-bold rounded-xl transition shadow-sm bg-blue-600 text-white flex items-center justify-center gap-2';
      }
      if (tabKasir) {
        tabKasir.className = 'flex-1 py-2.5 text-xs font-bold rounded-xl transition text-slate-400 hover:text-white flex items-center justify-center gap-2';
      }
      if (roleBadge) {
        roleBadge.className = 'px-2.5 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30 inline-flex items-center gap-1.5';
        roleBadge.innerHTML = '<i class="fa-solid fa-user-shield"></i> Masuk Sebagai Admin';
      }
      if (userInput && !userInput.value) userInput.value = 'admin';
      if (passInput && !passInput.value) passInput.value = 'admin123';
    }
  }

  // Quick Login (Demo 1-Klik)
  quickLogin(role) {
    const userInput = document.getElementById('login-username');
    const passInput = document.getElementById('login-password');

    if (role === 'kasir') {
      if (userInput) userInput.value = 'kasir';
      if (passInput) passInput.value = 'kasir123';
      this.setRoleTab('kasir');
    } else {
      if (userInput) userInput.value = 'admin';
      if (passInput) passInput.value = 'admin123';
      this.setRoleTab('admin');
    }

    this.login(userInput.value, passInput.value, true);
  }

  // Toggle Tampilkan / Sembunyikan Password
  togglePasswordVisibility() {
    const input = document.getElementById('login-password');
    const icon = document.getElementById('login-password-icon');
    if (!input || !icon) return;

    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fa-solid fa-eye-slash text-slate-400 hover:text-white';
    } else {
      input.type = 'password';
      icon.className = 'fa-solid fa-eye text-slate-400 hover:text-white';
    }
  }

  // Terapkan pembatasan hak akses tampilan berdasarkan peran yang aktif
  applyRoleRestrictions() {
    if (!this.currentUser) return;

    const isAdmin = this.isAdmin();
    const user = this.currentUser;

    // 1. Perbarui Info Pengguna di Sidebar
    const userAvatarEl = document.getElementById('sidebar-user-avatar');
    const userNameEl = document.getElementById('sidebar-user-name');
    const userRoleEl = document.getElementById('sidebar-user-role');
    const userRoleBadge = document.getElementById('sidebar-user-badge');

    if (userNameEl) userNameEl.innerText = user.name;
    if (userRoleEl) {
      userRoleEl.innerText = isAdmin ? 'Administrator' : 'Kasir Toko';
    }
    if (userRoleBadge) {
      userRoleBadge.className = isAdmin
        ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30'
        : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      userRoleBadge.innerText = isAdmin ? 'ADMIN' : 'KASIR';
    }
    if (userAvatarEl) {
      userAvatarEl.className = isAdmin
        ? 'w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md'
        : 'w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md';
      userAvatarEl.innerHTML = `<i class="fa-solid ${isAdmin ? 'fa-user-shield' : 'fa-user-tag'}"></i>`;
    }

    // 2. Perbarui Tombol Navigasi Sidebar
    const adminOnlyNavs = ['nav-stock', 'nav-categories', 'nav-monthly', 'nav-settings'];
    adminOnlyNavs.forEach(navId => {
      const navBtn = document.getElementById(navId);
      if (navBtn) {
        if (isAdmin) {
          navBtn.classList.remove('hidden');
        } else {
          // Sembunyikan menu manajemen dan laporan sensitif untuk kasir
          navBtn.classList.add('hidden');
        }
      }
    });

    // 3. Tombol Tambah Barang Cepat di Topbar Kasir
    const topAddProductBtn = document.getElementById('top-btn-add-product');
    if (topAddProductBtn) {
      if (isAdmin) {
        topAddProductBtn.classList.remove('hidden');
      } else {
        topAddProductBtn.classList.add('hidden');
      }
    }

    // 4. Sembunyikan kolom Laba / Profit di tabel Riwayat Harian jika login sebagai Kasir
    const profitElements = document.querySelectorAll('.admin-profit-field');
    profitElements.forEach(el => {
      if (isAdmin) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // 5. Jika admin membuka menu Pengaturan, muat daftar kasir
    if (isAdmin && window.app && typeof window.app.renderUsersList === 'function') {
      window.app.renderUsersList();
    }
  }
}

// Inisialisasi global authManager
window.authManager = new AuthManager();
