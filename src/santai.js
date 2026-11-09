// santai.js - Generator Animasi Perayaan Santai & Absurd
// "Kalau Bisa Santai, Ya Santailah, FAK OFF Rezim"
// Menggunakan Web Audio API retro fanfare 8-bit & efek confetti / meme floating

/**
 * Mainkan audio fanfare retro 8-bit yang ceria menggunakan Web Audio API
 */
export function playSantaiFanfare() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Nada arpeggio kemenangan: C4, E4, G4, C5, G4, C5, E5, G5
    const notes = [
      { freq: 261.63, dur: 0.12, type: "square" }, // C4
      { freq: 329.63, dur: 0.12, type: "square" }, // E4
      { freq: 392.00, dur: 0.12, type: "triangle" }, // G4
      { freq: 523.25, dur: 0.18, type: "square" }, // C5
      { freq: 392.00, dur: 0.12, type: "triangle" }, // G4
      { freq: 523.25, dur: 0.16, type: "square" }, // C5
      { freq: 659.25, dur: 0.20, type: "triangle" }, // E5
      { freq: 783.99, dur: 0.50, type: "square" }  // G5 (held)
    ];

    let startTime = ctx.currentTime + 0.05;

    notes.forEach((n, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, startTime);

      // Cute vibrato pada nada terakhir
      if (idx === notes.length - 1) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(8, startTime);
        lfoGain.gain.setValueAtTime(12, startTime);
        lfo.connect(osc.frequency);
        lfo.start(startTime);
        lfo.stop(startTime + n.dur);
      }

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + n.dur);

      startTime += n.dur * 0.9;
    });
  } catch (err) {
    // Abaikan jika browser memblokir audio autoplay
  }
}

/**
 * Buat elemen SVG Bebek Santuy yang sedang rebahan di atas pelampung
 */
function createDuckSvgHtml() {
  return `
    <svg viewBox="0 0 120 120" width="105" height="105" style="overflow: visible;">
      <!-- Pelampung Donat / Flaminggo -->
      <ellipse cx="60" cy="88" rx="46" ry="20" fill="#ec4899" stroke="#be185d" stroke-width="3"/>
      <ellipse cx="60" cy="88" rx="26" ry="11" fill="#0f172a"/>
      
      <!-- Percikan Air / Gelombang Santai -->
      <path d="M 12 92 Q 22 98 32 92 Q 42 86 52 92 Q 62 98 72 92 Q 82 86 92 92 Q 102 98 112 92" 
            fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
      
      <!-- Badan Bebek Kuning Gemoy -->
      <ellipse cx="60" cy="68" rx="30" ry="24" fill="#facc15" stroke="#ca8a04" stroke-width="2.5"/>
      
      <!-- Sayap Bebek (Santai Melambai) -->
      <path d="M 34 64 Q 24 50 40 58 Z" fill="#eab308" stroke="#ca8a04" stroke-width="2"/>
      <path d="M 86 64 Q 102 54 84 72 Z" fill="#eab308" stroke="#ca8a04" stroke-width="2"/>

      <!-- Kepala Bebek -->
      <circle cx="60" cy="40" r="22" fill="#facc15" stroke="#ca8a04" stroke-width="2.5"/>
      <ellipse cx="67" cy="40" r="4" ry="2" fill="#f87171" opacity="0.6"/> <!-- Blush Pipi Kanan -->
      <ellipse cx="53" cy="40" r="4" ry="2" fill="#f87171" opacity="0.6"/> <!-- Blush Pipi Kiri -->

      <!-- Paruh Bebek Oranye Lucu -->
      <ellipse cx="60" cy="46" rx="14" ry="7" fill="#fb923c" stroke="#c2410c" stroke-width="2"/>
      <line x1="48" y1="46" x2="72" y2="46" stroke="#c2410c" stroke-width="1.5"/>

      <!-- Mata Bebek (Tersenyum Bahagia Sebelum Kacamata Jatuh) -->
      <path d="M 50 36 Q 54 32 58 36" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
      <path d="M 62 36 Q 66 32 70 36" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>

      <!-- Topi Jerami Pantai Santuy -->
      <ellipse cx="60" cy="22" rx="28" ry="8" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
      <ellipse cx="60" cy="18" rx="16" ry="7" fill="#eab308" stroke="#ca8a04" stroke-width="2"/>
      <rect x="44" y="16" width="32" height="4" fill="#0d9488"/>

      <!-- Minuman Kelapa Muda Tropis di Sayap Kanan -->
      <g transform="translate(82, 60)">
        <circle cx="10" cy="10" r="9" fill="#78350f"/>
        <ellipse cx="10" cy="4" rx="7" ry="3" fill="#fef3c7"/>
        <!-- Sedotan Hijau & Payung Mini -->
        <line x1="10" y1="4" x2="16" y2="-6" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
        <path d="M 12 -2 Q 18 -10 24 -4 Z" fill="#f43f5e"/>
      </g>
    </svg>
  `;
}

/**
 * Buat elemen SVG Kacamata Hitam "DEAL WITH IT"
 */
function createSunglassesSvgHtml() {
  return `
    <svg viewBox="0 0 90 32" width="70" height="26">
      <!-- Frame Hitam Pixel/Retro -->
      <path d="M 2 4 L 40 4 L 40 22 L 26 22 L 22 28 L 6 28 L 2 20 Z" fill="#09090b" stroke="#ffffff" stroke-width="1.2"/>
      <path d="M 48 4 L 86 4 L 86 20 L 82 28 L 66 28 L 62 22 L 48 22 Z" fill="#09090b" stroke="#ffffff" stroke-width="1.2"/>
      <!-- Jembatan Hidung -->
      <rect x="38" y="7" width="14" height="4" fill="#09090b"/>
      <!-- Pantulan Cahaya Putih (Shine) -->
      <rect x="8" y="7" width="6" height="4" fill="#ffffff" opacity="0.9"/>
      <rect x="16" y="13" width="4" height="4" fill="#ffffff" opacity="0.8"/>
      <rect x="54" y="7" width="6" height="4" fill="#ffffff" opacity="0.9"/>
      <rect x="62" y="13" width="4" height="4" fill="#ffffff" opacity="0.8"/>
    </svg>
  `;
}

/**
 * Tampilkan modal animasi perayaan Santai & Absurd
 * 
 * @param {object} options
 * @param {HTMLElement} options.container - Target container untuk menempelkan overlay
 * @param {object} options.userData - Informasi user yang berhasil login (nama, email, masaBerlaku)
 * @param {function} options.onDismiss - Callback saat animasi ditutup
 */
export function showSantaiCelebration({ container = document.body, userData = {}, onDismiss = null } = {}) {
  // Cegah duplikasi overlay jika sudah terbuka
  const existing = container.querySelector(".santai-overlay");
  if (existing) existing.remove();

  playSantaiFanfare();

  const overlay = document.createElement("div");
  overlay.className = "santai-overlay";

  // Emoji partikel yang melayang ke atas
  const particles = ["🦆", "🌴", "🍹", "🕶️", "💸", "🏖️", "🔥", "🍉", "☕", "💃", "🎉", "✨", "💉", "🚀"];
  let particlesHtml = "";
  for (let i = 0; i < 20; i++) {
    const p = particles[i % particles.length];
    const left = Math.floor(Math.random() * 92) + "%";
    const delay = (Math.random() * 2.5).toFixed(2) + "s";
    const duration = (3.2 + Math.random() * 2.2).toFixed(2) + "s";
    const size = (16 + Math.random() * 12).toFixed(0) + "px";
    particlesHtml += `<div class="santai-particle" style="left: ${left}; animation-delay: ${delay}; animation-duration: ${duration}; font-size: ${size};">${p}</div>`;
  }

  const namaDisplay = userData.namaPengguna || userData.nama || userData.email || "Sobat Santai CKG";
  const expDisplay = userData.masaBerlaku ? `Masa Aktif: ${userData.masaBerlaku}` : "Status: Aktif";

  overlay.innerHTML = `
    <div class="santai-sunburst"></div>
    <div class="santai-particles">${particlesHtml}</div>

    <div class="santai-card">
      <div class="santai-badge-top">
        🌴 ANTI PANIK-PANIK CLUB • CKG MODE 🌴
      </div>

      <div class="santai-stage">
        <div class="santai-duck-wrapper">
          ${createDuckSvgHtml()}
        </div>
        <div class="santai-glasses">
          ${createSunglassesSvgHtml()}
        </div>
        <div class="santai-sparkle">✨</div>
        <div class="santai-speech">Santuyy Entri CKG Bro~ ☕</div>
      </div>

      <div class="santai-headline-box">
        <h2 class="santai-headline">
          "Kalau Bisa Santai,Ya Santailah, FAK OFF Rezim"
        </h2>
      </div>

      <div class="santai-gratitude-box">
        <div class="santai-gratitude-text">
          <span>❤️ Terimakasih sudah berlangganan, support terus ya! 🚀</span>
        </div>
        <div class="santai-user-info">
          <span>Login sebagai: <b>${namaDisplay}</b> (${expDisplay})</span>
        </div>
      </div>

      <div class="santai-badges-row">
        <span class="santai-mini-badge">✨ Lisensi Terverifikasi</span>
        <span class="santai-mini-badge">⚡ CKG Injector Kilat</span>
        <span class="santai-mini-badge">☕ Anti Emosi SehatIndonesiaku</span>
        <span class="santai-mini-badge">🚀 Auto Eksekusi Excel</span>
      </div>

      <button type="button" class="santai-btn-dismiss" id="btn-santai-dismiss">
        <span>Gass Santai Bro! 😎🍹</span>
      </button>
    </div>
  `;

  container.appendChild(overlay);

  const dismissBtn = overlay.querySelector("#btn-santai-dismiss");
  let isClosing = false;
  const dismiss = () => {
    if (isClosing) return;
    isClosing = true;
    overlay.style.transition = "opacity 0.25s, transform 0.25s";
    overlay.style.opacity = "0";
    overlay.style.transform = "scale(0.95)";
    setTimeout(() => {
      overlay.remove();
      if (typeof onDismiss === "function") onDismiss();
    }, 250);
  };

  dismissBtn?.addEventListener("click", dismiss);

  // Klik di luar kartu juga menutup animasi
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
  });

  return { overlay, dismiss };
}

