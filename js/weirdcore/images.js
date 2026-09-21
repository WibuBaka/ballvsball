/* ============================================================================
   THE WEIRDCORE?!  -  images.js
   ----------------------------------------------------------------------------
   Hệ thống hình ảnh weirdcore.
     * Danh sách nằm ở WEIRDCORE_IMAGES (config.js).  Thả PNG/JPG vào assets/weirdcore/
       rồi đổi enabled:true là xong.
     * Ảnh nào chưa có / tải lỗi -> tự vẽ PLACEHOLDER procedural cùng `kind`,
       nên game luôn chạy được kể cả khi thư mục ảnh trống.
     * Ảnh chỉ được tải khi có The Weirdcore trong trận (không tốn gì ở menu).
     * KHÔNG spam: ScreenDistortion (screen.js) quyết định lúc nào chớp, ở đâu, mờ cỡ nào.
   ========================================================================== */

// deterministic RNG -> ảnh procedural giống hệt nhau mỗi lần
function wcRng(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function wcCanvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Con mắt kiểu ảnh tham chiếu: lòng trắng xám, đồng tử ĐEN to, 2 chấm sáng nhỏ.
// open 0..1 (mí mắt), lx/ly -1..1 (hướng nhìn). Dùng cho cả ảnh procedural lẫn mắt ở rìa màn hình.
function drawWeirdEye(ctx, x, y, w, open, lx, ly, alpha){
  const h = w * 0.30 * open;
  ctx.save();
  if (h < 0.7){
    ctx.globalAlpha = alpha * 0.55; ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
    ctx.restore(); return;
  }
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y - h * 2, x + w / 2, y);
  ctx.quadraticCurveTo(x, y + h * 1.8, x - w / 2, y);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, '#7d7d7d'); g.addColorStop(0.5, '#e6e6e6'); g.addColorStop(1, '#727272');
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  const pr = Math.min(h * 1.05, w * 0.24), px = x + lx * w * 0.16, py = y + ly * h * 0.35;
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px - pr * 0.36, py - pr * 0.40, Math.max(0.7, pr * 0.16), 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.arc(px + pr * 0.30, py - pr * 0.20, Math.max(0.5, pr * 0.08), 0, 6.2832); ctx.fill();
  ctx.restore();
  // viền mí mắt rất mờ
  ctx.save(); ctx.globalAlpha = alpha * 0.5; ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(0.6, w * 0.02);
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x, y - h * 2, x + w / 2, y); ctx.stroke();
  ctx.restore();
}

/* ------------------------- procedural placeholders -------------------------- */
// ảnh 2: bức tường mắt đen trên nền đen
function procEyes(){
  const W = 150, H = 150, c = wcCanvas(W, H), x = c.getContext('2d'), r = wcRng(11);
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++){
    const w = 26 + r() * 34;
    drawWeirdEye(x, r() * W, r() * H, w, 0.75 + r() * 0.25, (r() * 2 - 1) * 0.6, (r() * 2 - 1) * 0.5, 0.9);
  }
  return c;
}
// ảnh 3: đám "?" trắng chồng lên nhau, xen vài "12" / "E"
function procQmarks(){
  const W = 140, H = 140, c = wcCanvas(W, H), x = c.getContext('2d'), r = wcRng(7);
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fff'; x.textBaseline = 'top';
  for (let i = 0; i < 420; i++){
    const y = H * Math.pow(r(), 0.55), size = 9 + r() * 15, px = r() * W - size * 0.3;
    x.globalAlpha = 0.35 + r() * 0.65;
    x.font = 'bold ' + size + 'px monospace';
    const q = r();
    x.fillText(q < 0.025 ? '12' : (q < 0.05 ? 'E' : '?'), px, y);
  }
  x.globalAlpha = 0.5; x.drawImage(c, 0, 1);            // vệt "smear" như màn hình cũ
  return c;
}
// ảnh 1: đồi xanh + bầu trời mây, phủ "?" hồng và mắt, lưới CRT
function procBliss(){
  const W = 110, H = 196, c = wcCanvas(W, H), x = c.getContext('2d'), r = wcRng(23);
  const sky = x.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#1240ff'); sky.addColorStop(1, '#86b4ff');
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++){                            // mây
    const cx = r() * W, cy = H * (0.05 + r() * 0.5), rad = 14 + r() * 22;
    const g = x.createRadialGradient(cx, cy, 1, cx, cy, rad); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  const hill = x.createLinearGradient(0, H * 0.55, 0, H * 0.85); hill.addColorStop(0, '#5ec02c'); hill.addColorStop(1, '#1f6a14');
  x.fillStyle = hill; x.beginPath(); x.moveTo(0, H * 0.58); x.quadraticCurveTo(W * 0.55, H * 0.52, W, H * 0.64); x.lineTo(W, H); x.lineTo(0, H); x.fill();
  x.fillStyle = '#7a1a12'; x.fillRect(0, H * 0.80, W, H * 0.20);                 // đáy đỏ nhiễu
  for (let i = 0; i < 260; i++){ x.fillStyle = r() < 0.5 ? '#3d0a08' : '#b3402c'; x.fillRect(r() * W, H * (0.80 + r() * 0.20), 1 + r() * 2, 1 + r() * 2); }
  x.textBaseline = 'top'; x.fillStyle = '#ff7ad9';
  for (let i = 0; i < 46; i++){ x.globalAlpha = 0.45 + r() * 0.5; x.font = 'bold ' + (10 + r() * 14) + 'px monospace'; x.fillText('?', r() * W, r() * H * 0.96); }
  x.globalAlpha = 1;
  for (let i = 0; i < 6; i++) drawWeirdEye(x, r() * W, H * (0.1 + r() * 0.85), 26 + r() * 26, 0.9, (r() * 2 - 1) * 0.5, (r() * 2 - 1) * 0.4, 0.75);
  x.fillStyle = 'rgba(0,0,0,.14)'; for (let yy = 0; yy < H; yy += 2) x.fillRect(0, yy, W, 1);   // lưới scanline
  return c;
}
// bóng người trắng nhợt có 1 con mắt (trong suốt nền)
function procFigure(){
  const W = 80, H = 150, c = wcCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#d9d9d0';
  x.beginPath(); x.moveTo(30, 6); x.lineTo(62, 22); x.lineTo(52, 40); x.lineTo(46, 46); x.lineTo(50, H - 4); x.lineTo(28, H - 4); x.lineTo(30, 46); x.lineTo(14, 34); x.closePath(); x.fill();
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(30, 46, 20, H - 50);
  drawWeirdEye(x, 46, 26, 16, 1, 0.3, 0, 0.95);
  return c;
}
// hành lang trống, ánh sáng vàng nhạt (liminal)
function procCorridor(){
  const W = 120, H = 110, c = wcCanvas(W, H), x = c.getContext('2d'), vx = 60, vy = 54;
  x.fillStyle = '#8d8968'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#6e6a4a'; x.beginPath(); x.moveTo(0, H); x.lineTo(W, H); x.lineTo(vx + 18, vy + 12); x.lineTo(vx - 18, vy + 12); x.fill();    // sàn
  x.fillStyle = '#a49f7a'; x.beginPath(); x.moveTo(0, 0); x.lineTo(vx - 18, vy - 12); x.lineTo(vx - 18, vy + 12); x.lineTo(0, H); x.fill();    // tường trái
  x.beginPath(); x.moveTo(W, 0); x.lineTo(vx + 18, vy - 12); x.lineTo(vx + 18, vy + 12); x.lineTo(W, H); x.fill();                             // tường phải
  x.fillStyle = '#4b4832'; x.fillRect(vx - 18, vy - 12, 36, 24);                                                                              // tường cuối
  x.fillStyle = '#15130b'; x.fillRect(vx - 5, vy - 3, 10, 15);                                                                                // cánh cửa
  x.fillStyle = 'rgba(240,238,200,.8)'; for (let i = 0; i < 4; i++){ const k = i / 4, w = 34 - k * 26; x.fillRect(vx - w / 2, 8 + k * 30, w, 3 - k * 1.5); } // đèn trần
  const g = x.createRadialGradient(vx, vy, 8, vx, vy, 80); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  return c;
}
// khuôn mặt méo: mắt cách xa nhau, miệng nhỏ lệch
function procFace(){
  const W = 90, H = 130, c = wcCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#b8a692'; x.beginPath(); x.ellipse(45, 66, 34, 58, 0, 0, 6.2832); x.fill();
  x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(58, 76, 22, 46, 0, 0, 6.2832); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.ellipse(17, 52, 3.4, 5.4, 0, 0, 6.2832); x.fill(); x.beginPath(); x.ellipse(73, 55, 3.4, 5.4, 0, 0, 6.2832); x.fill();
  x.fillStyle = '#2a1c18'; x.fillRect(48, 104, 9, 1.6);
  return c;
}
// một con mắt đơn độc, rất xa
function procEye(){
  const c = wcCanvas(64, 40), x = c.getContext('2d');
  drawWeirdEye(x, 32, 20, 56, 1, -0.2, 0.1, 1);
  return c;
}

/* -------------------------------- pool ------------------------------------- */
class WeirdImages {
  constructor(cfg, list){
    this.cfg = cfg; this.list = list; this.items = []; this.ready = false; this.lastId = '';
  }
  static get GEN(){
    return { bliss: procBliss, eyes: procEyes, qmarks: procQmarks, face: procFace, eye: procEye, corridor: procCorridor, figure: procFigure };
  }
  init(){
    if (this.ready) return;
    this.ready = true;
    for (const m of this.list){
      const it = Object.assign({}, m, { img: null, state: 'idle' });
      this.items.push(it);
      const hasGen = !!WeirdImages.GEN[m.kind];
      if (m.enabled){
        it.state = 'loading';
        const im = new Image();
        im.onload = () => { it.img = im; it.state = 'ready'; };
        im.onerror = () => { it.img = null; it.state = hasGen ? 'proc' : 'dead'; };
        // WEIRDCORE_INLINE: bản đóng gói 1 file (artifact) nhúng ảnh dạng data URI; bản thường dùng assets/weirdcore/
        im.src = (typeof WEIRDCORE_INLINE !== 'undefined' && WEIRDCORE_INLINE[m.src]) || (this.cfg.assetDir + m.src);
      } else it.state = hasGen ? 'proc' : 'dead';
    }
  }
  source(it){
    if (it.state === 'ready') return it.img;
    if (it.state === 'proc'){ if (!it.img) it.img = WeirdImages.GEN[it.kind](); return it.img; }
    return null;
  }
  // chọn ngẫu nhiên có trọng số, tránh lặp lại đúng ảnh vừa hiện
  pick(I, kind){
    const pool = [];
    let total = 0;
    for (const it of this.items){
      if (kind ? it.kind !== kind : I < it.minI) continue;
      if (it.state !== 'ready' && it.state !== 'proc') continue;
      if (!kind && it.id === this.lastId && this.items.length > 1) continue;
      pool.push(it); total += it.weight || 1;
    }
    if (!pool.length) return null;
    let r = Math.random() * total, chosen = pool[0];
    for (const it of pool){ r -= (it.weight || 1); if (r <= 0){ chosen = it; break; } }
    const src = this.source(chosen);
    if (!src) return null;
    this.lastId = chosen.id;
    return { it: chosen, src };
  }
}
