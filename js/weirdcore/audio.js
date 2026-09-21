/* ============================================================================
   THE WEIRDCORE?!  -  audio.js
   ----------------------------------------------------------------------------
   Dự án chưa có hệ thống âm thanh nên file này tự tạo âm thanh bằng WebAudio
   (không cần file .mp3). Bản sắc âm thanh:
     * low-frequency hum (2 sóng sin lệch nhau ~2Hz => "phập phồng" khó chịu)
     * static rất nhẹ + tiếng rít CRT gần như không nghe thấy
     * nhịp tim cực nhẹ (đôi) khi Anxiety cao
     * "reversed sound" cực ngắn, thỉnh thoảng
     * tiếng UI méo khi HUD glitch
   KHÔNG có tiếng hét / jumpscare. Mọi thứ nhỏ và thấp - mục tiêu là
   "có gì đó đang ở đây".  Chỉ chạy khi có The Weirdcore trong trận.
   Tắt: WEIRDCORE_CONFIG.audio=false  hoặc  ?wcmute=1
   [NEED ASSET (tuỳ chọn): nếu muốn dùng file thật, có thể thay các hàm _blip/_thump bằng
    new Audio('assets/weirdcore/xxx.mp3')]
   ========================================================================== */

class WeirdAudio {
  constructor(){
    this.ac = null; this.on = false; this.n = null; this.hb = 0; this.rev = null; this.killT = 0;
    document.addEventListener('visibilitychange', () => {
      if (!this.ac || !this.on) return;
      if (document.hidden) this.ac.suspend().catch(() => {}); else this.ac.resume().catch(() => {});
    });
  }

  // phải gọi từ 1 thao tác của người chơi (nút "Vào trận" / "Đấu lại") thì iOS mới cho phát
  start(){
    if (!WEIRDCORE_CONFIG.audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (!this.ac) this.ac = new AC(); } catch (e){ return; }
    const ac = this.ac;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    if (this.on) return;
    this.on = true; this.hb = 1.5;
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0, now); master.gain.linearRampToValueAtTime(0.9, now + 1.2);
    master.connect(ac.destination);

    // hum
    const humG = ac.createGain(); humG.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150;
    const o1 = ac.createOscillator(); o1.frequency.value = 41;
    const o2 = ac.createOscillator(); o2.frequency.value = 43.3;
    o1.connect(humG); o2.connect(humG); humG.connect(lp); lp.connect(master);
    // whine CRT (gần như không nghe thấy)
    const whG = ac.createGain(); whG.gain.value = 0;
    const wh = ac.createOscillator(); wh.frequency.value = 5200;
    wh.connect(whG); whG.connect(master);
    // static
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const ns = ac.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
    const stG = ac.createGain(); stG.gain.value = 0;
    ns.connect(bp); bp.connect(stG); stG.connect(master);
    o1.start(); o2.start(); wh.start(); ns.start();
    this.n = { master, humG, whG, stG, nodes: [o1, o2, wh, ns] };

    // "reversed sound": 1 tiếng ping ngắn rồi lật ngược buffer
    if (!this.rev){
      const sr = ac.sampleRate, n = Math.floor(sr * 0.3), b = ac.createBuffer(1, n, sr), dd = b.getChannelData(0);
      for (let i = 0; i < n; i++){
        const t = i / sr;
        dd[n - 1 - i] = Math.sin(2 * Math.PI * (430 + 300 * t / 0.3) * t) * Math.exp(-t * 11) * (0.7 + 0.3 * Math.random());
      }
      this.rev = b;
    }
  }

  // gọi mỗi frame: I = cường độ 0..1
  update(I, dt){
    if (!this.on || !this.n) return;
    const ac = this.ac, now = ac.currentTime, n = this.n;
    n.humG.gain.setTargetAtTime(I > 0.04 ? 0.012 + 0.10 * Math.pow(I, 1.2) : 0, now, 0.5);
    n.stG.gain.setTargetAtTime(0.003 + 0.020 * I * I, now, 0.4);
    n.whG.gain.setTargetAtTime(0.0004 + 0.0028 * I * I, now, 0.5);
    this.hb -= dt;
    if (I > 0.22 && this.hb <= 0){ this._beat(I); this.hb = 60 / (50 + 40 * I); }
    if (I > 0.30 && Math.random() < dt * (0.04 + 0.22 * I)) this.reversed(I);
  }

  _thump(t0, vol){
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';                                  // có hài bậc cao -> loa điện thoại vẫn nghe "thịch"
    o.frequency.setValueAtTime(78, t0); o.frequency.exponentialRampToValueAtTime(36, t0 + 0.13);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    o.connect(g); g.connect(this.n.master); o.start(t0); o.stop(t0 + 0.22);
  }
  _beat(I){
    const t = this.ac.currentTime + 0.01, v = 0.09 * I;
    this._thump(t, v); this._thump(t + 0.19, v * 0.7);
  }

  reversed(I){
    if (!this.on || !this.rev) return;
    const ac = this.ac, s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = this.rev; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    g.gain.value = 0.03 + 0.04 * (I || 0.5);
    let out = g;
    if (ac.createStereoPanner){ const p = ac.createStereoPanner(); p.pan.value = Math.random() * 2 - 1; g.connect(p); out = p; }
    s.connect(g); out.connect(this.n.master); s.start();
  }

  // tiếng UI méo ngắn (khi HUD / tên glitch)
  uiGlitch(){
    if (!this.on) return;
    const ac = this.ac, t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), ws = ac.createWaveShaper();
    const c = new Float32Array(256); for (let i = 0; i < 256; i++){ const x = i / 128 - 1; c[i] = Math.tanh(x * 6); }
    ws.curve = c;
    o.type = 'square'; o.frequency.setValueAtTime(140 + Math.random() * 280, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + 0.08);
    g.gain.setValueAtTime(0.014, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    o.connect(ws); ws.connect(g); g.connect(this.n.master); o.start(t0); o.stop(t0 + 0.1);
  }

  // đổi stage: một nhịp trầm sụt xuống
  swell(stage){
    if (!this.on) return;
    const ac = this.ac, t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(52 - stage * 4, t0); o.frequency.exponentialRampToValueAtTime(28, t0 + 1.4);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05 + stage * 0.012, t0 + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
    o.connect(g); g.connect(this.n.master); o.start(t0); o.stop(t0 + 1.6);
  }

  stop(){
    if (!this.on || !this.n) return;
    this.on = false;
    const ac = this.ac, n = this.n, now = ac.currentTime;
    n.master.gain.cancelScheduledValues(now); n.master.gain.setValueAtTime(n.master.gain.value, now); n.master.gain.linearRampToValueAtTime(0, now + 0.5);
    this.killT = setTimeout(() => {
      n.nodes.forEach(x => { try { x.stop(); } catch (e) {} });
      try { n.master.disconnect(); } catch (e) {}
    }, 650);
    this.n = null;
  }
}
