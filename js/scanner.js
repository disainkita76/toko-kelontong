/**
 * Toko Aneka - Barcode Scanner Engine
 * Mendukung:
 * 1. Scanner fisik USB / Bluetooth (keystroke buffer detection)
 * 2. Scanner kamera (Laptop/HP) via Html5Qrcode library
 * 3. Audio feedback beeper sintetis (Web Audio API)
 */

class BarcodeManager {
  constructor() {
    this.html5QrCode = null;
    this.isCameraScanning = false;
    this.currentScanTarget = null; // 'pos' atau 'stock-input'
    this.onScanCallback = null;

    // Buffer untuk scanner fisik USB
    this.buffer = '';
    this.lastKeyTime = Date.now();
    this.keyThreshold = 50; // ms antar karakter barcode scanner fisik

    this.initPhysicalScanner();
    this.initAudio();
  }

  // Sintesis audio bip kasir menggunakan Web Audio API tanpa perlu file mp3 eksternal
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('AudioContext tidak didukung:', e);
    }
  }

  playBeep(success = true) {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (success) {
        // Nada bip kasir sukses: frekuensi tinggi singkat
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
      } else {
        // Nada error/gagal
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('Gagal memutar audio:', e);
    }
  }

  // Deteksi scanner fisik USB
  initPhysicalScanner() {
    window.addEventListener('keydown', (e) => {
      // Abaikan tombol modifier
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;

      const currentTime = Date.now();
      const timeDiff = currentTime - this.lastKeyTime;
      this.lastKeyTime = currentTime;

      // Jika jeda terlalu lama, reset buffer
      if (timeDiff > 200) {
        this.buffer = '';
      }

      if (e.key === 'Enter') {
        if (this.buffer.length >= 3) {
          const scannedCode = this.buffer.trim();
          this.buffer = '';
          // Jangan kirim form jika scanner mengirim enter
          if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            // Biarkan input field memproses jika diperlukan atau tangani global
          }
          this.handleScannedCode(scannedCode, 'hardware');
        }
      } else if (e.key.length === 1) {
        this.buffer += e.key;
      }
    });
  }

  // Buka kamera untuk pemindaian
  async startCamera(targetMode = 'pos', callback = null) {
    this.currentScanTarget = targetMode;
    this.onScanCallback = callback;

    const modal = document.getElementById('camera-scanner-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }

    if (this.isCameraScanning) return;

    try {
      if (!window.Html5Qrcode) {
        alert('Library pemindai kamera belum siap. Pastikan terhubung internet untuk load library pertama kali.');
        this.stopCamera();
        return;
      }

      this.html5QrCode = new Html5Qrcode('qr-reader');
      this.isCameraScanning = true;

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.333,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      };

      await this.html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          this.handleScannedCode(decodedText, 'camera');
        },
        (errorMessage) => {
          // Scanner berjalan mencari frame barcode
        }
      );
    } catch (err) {
      console.error('Kamera gagal dimulai:', err);
      alert('Tidak dapat mengakses kamera: ' + (err.message || 'Periksa izin kamera pada browser Anda.'));
      this.stopCamera();
    }
  }

  // Hentikan pemindaian kamera
  async stopCamera() {
    const modal = document.getElementById('camera-scanner-modal');
    if (modal) {
      modal.classList.add('hidden');
    }

    if (this.html5QrCode && this.isCameraScanning) {
      try {
        await this.html5QrCode.stop();
        await this.html5QrCode.clear();
      } catch (e) {
        console.warn('Gagal stop kamera:', e);
      }
    }
    this.isCameraScanning = false;
    this.html5QrCode = null;
  }

  // Tangani hasil barcode
  handleScannedCode(code, source = 'manual') {
    this.playBeep(true);

    if (this.onScanCallback) {
      this.onScanCallback(code);
      if (this.currentScanTarget === 'stock-input') {
        this.stopCamera();
      }
      return;
    }

    // Default: Kirim ke sistem aplikasi utama
    if (window.app && typeof window.app.onBarcodeReceived === 'function') {
      window.app.onBarcodeReceived(code, this.currentScanTarget);
    }

    // Jika mode input barang di stokis, otomatis tutup modal scanner
    if (this.currentScanTarget === 'stock-input') {
      this.stopCamera();
    }
  }
}

// Instance global
window.barcodeManager = new BarcodeManager();
