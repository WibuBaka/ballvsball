/* ============================================================================
   THE WEIRDCORE?!  -  screen.js   (ScreenDistortion)
   ----------------------------------------------------------------------------
   Hiệu ứng TOÀN MÀN HÌNH, gồm 2 phần:

   1) OVERLAY canvas (#weirdFx) phủ cả viewport, độ phân giải THẤP cố ý (0.28-0.5x)
      -> nhẹ cho mobile VÀ tự có chất "analog low-res". pointer-events:none nên không
      chặn cảm ứng. Các lớp, từ nhẹ đến nặng theo cường độ I (0..1):
        vignette • vùng tối bất thường • mắt nhìn từ rìa (ngoài sân) • đám "???" trôi ở rìa •
        noise • scanline + dải cuộn • thanh/khối nhiễu • bóng ma của UI • hình weirdcore chớp
        (vài frame, mờ, bị cắt, ở rìa) • chớp đen

   2) POST-FX lên canvas game: dải "xé hình" (frame tearing) + lệch màu RGB nháy ngắn.

   Mọi thứ do sự kiện ngẫu nhiên tần suất THẤP điều khiển (rate/giây) - "ít nhưng đáng sợ".
   Không có particle, không blur, không filter, không DOM mới mỗi frame.
   ========================================================================== */

class ScreenDistortion {
  constructor(){
    this.cv = null; this.ctx = null;
    this.w = 0; this.h = 0; this.kx = 0.5; this.ky = 0.5; this.scaleKey = '';
    this.vig = null; this.noise = []; this.scanPat = null;
    this.regions = []; this.eyes = []; this.flashes = []; this.rects = []; this.ghosts = [];
    this.dark = { until: 0, a: 0 }; this.pulseA = 0;
    this.tear = { until: 0, strips: [] };
    this.chroma = { until: 0, amt: 0 };
    this.sA = null; this.sR = null; this.sC = null; this.sKey = '';
    this.arena = null; this.hud = []; this.measureT = -9;
    this.lastFlash = -9; this.swarmSrc = null; this.swarmT = -9; this.swarmCrop = null;
    this.visible = false;
  }

  attach(){
    if (this.cv) return;
    const cv = document.createElement('canvas');
    cv.id = 'weirdFx';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    this.cv = cv; this.ctx = cv.getContext('2d');
    window.addEventListener('layoutchange', () => { this.scaleKey = ''; this.measureT = -9; });
  }

  setVisible(v){
    if (!this.cv) this.attach();
    if (v === this.visible) return;
    this.visible = v;
    this.cv.style.display = v ? 'block' : 'none';
    if (!v) this.reset();
  }

  reset(){
    this.eyes.length = 0; this.flashes.length = 0; this.rects.length = 0; this.ghosts.length = 0;
    this.dark.until = 0; this.pulseA = 0; this.tear.until = 0; this.chroma.until = 0;
    if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
  }

  // cú "giật" ngắn khi đổi stage / tăng tầng: chớp tối 1-2 frame
  pulse(a){ this.pulseA = Math.max(this.pulseA, a); }

  /* ---------------------------------------------------------------- layout */
  _fit(q){
    const key = innerWidth + 'x' + innerHeight + '@' + q.ovScale;
    if (key === this.scaleKey) return;
    this.scaleKey = key;
    const W = Math.max(64, Math.round(innerWidth * q.ovScale)), H = Math.max(64, Math.round(innerHeight * q.ovScale));
    this.cv.width = W; this.cv.height = H; this.w = W; this.h = H;
    this.kx = W / innerWidth; this.ky = H / innerHeight;
    this._buildCaches();
  }

  _buildCaches(){
    const W = this.w, H = this.h, diag = Math.hypot(W, H);
    // vignette: trong suốt ở giữa, đen ở góc
    const v = wcCanvas(W, H), x = v.getContext('2d');
    const g = x.createRadialGradient(W / 2, H / 2, diag * 0.16, W / 2, H / 2, diag * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    this.vig = v;
    // noise tiles (xám ngẫu nhiên, alpha ngẫu nhiên)
    this.noise = [];
    for (let n = 0; n < 3; n++){
      const c = wcCanvas(64, 64), cx = c.getContext('2d'), id = cx.createImageData(64, 64), d = id.data;
      for (let i = 0; i < d.length; i += 4){ const val = Math.random() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = val; d[i + 3] = Math.random() * 90 | 0; }
      cx.putImageData(id, 0, 0);
      this.noise.push(this.ctx.createPattern(c, 'repeat'));
    }
    // scanline 1x4
    const s = wcCanvas(1, 4), sx = s.getContext('2d'); sx.fillStyle = 'rgba(0,0,0,0.55)'; sx.fillRect(0, 0, 1, 1);
    this.scanPat = this.ctx.createPattern(s, 'repeat');
    // vài vùng tối bất thường quanh rìa/góc (đa giác méo, giữ cố định, chỉ đổi độ đậm)
    this.regions = [];
    const spots = [[0.02, 0.08], [0.98, 0.20], [0.06, 0.90], [0.94, 0.78], [0.5, 0.02], [0.5, 0.99]];
    for (const [px, py] of spots){
      const rw = W * (0.22 + Math.random() * 0.2), rh = H * (0.06 + Math.random() * 0.1), pts = [];
      for (let i = 0; i < 6; i++){
        const a = i / 6 * 6.2832;
        pts.push([px * W + Math.cos(a) * rw * (0.5 + Math.random() * 0.6), py * H + Math.sin(a) * rh * (0.5 + Math.random() * 0.7)]);
      }
      this.regions.push({ pts, ph: Math.random() * 6.28, sp: 0.15 + Math.random() * 0.35 });
    }
    this.eyes.length = 0;
  }

  // vị trí sân đấu + các khối HUD trên màn hình (toạ độ overlay). Đo lại thưa (~2 lần/giây).
  _measure(g, t){
    if (t - this.measureT < 0.5 && this.arena) return;
    this.measureT = t;
    const r = g.canvas.getBoundingClientRect(), kx = this.kx, ky = this.ky;
    this.arena = { x: r.left * kx, y: r.top * ky, w: r.width * kx, h: r.height * ky };
    this.hud.length = 0;
    document.querySelectorAll('#hud .hp-block, #statusBar').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width > 4) this.hud.push({ x: b.left * kx, y: b.top * ky, w: b.width * kx, h: b.height * ky });
    });
  }

  _roll(rate, dt){ return Math.random() < 1 - Math.exp(-rate * dt); }

  /* ------------------------------------------------------------- spawners */
  _spawnEye(t, I){
    const W = this.w, H = this.h, ar = this.arena;
    let x = 0, y = 0;
    for (let i = 0; i < 10; i++){                  // ưu tiên chỗ NGOÀI sân đấu
      x = W * (0.06 + Math.random() * 0.88); y = H * (0.03 + Math.random() * 0.94);
      if (!ar || x < ar.x - 6 || x > ar.x + ar.w + 6 || y < ar.y - 6 || y > ar.y + ar.h + 6) break;
    }
    this.eyes.push({ x, y, w: W * (0.07 + Math.random() * 0.13), born: t, life: 3 + Math.random() * 3.5, ph: Math.random() * 9, per: 2.4 + Math.random() * 2.6 });
  }

  _spawnFlash(o){
    const { I, t, imgs, q } = o, W = this.w, H = this.h;
    // đôi khi chỉ là 1 con mắt rất xa, cực nhỏ - thậm chí ngay trong sân
    const distant = I > 0.3 && Math.random() < 0.22;
    const pick = imgs.pick(I, distant ? 'eye' : null);
    if (!pick) return;
    const it = pick.it, src = pick.src, sw0 = src.naturalWidth || src.width, sh0 = src.naturalHeight || src.height;
    let sx, sy, sw, sh, dw, dh, dx, dy, alpha;
    if (distant){
      sx = 0; sy = 0; sw = sw0; sh = sh0; dw = W * (0.05 + Math.random() * 0.05); dh = dw * sh0 / sw0;
      dx = W * (0.15 + Math.random() * 0.7); dy = H * (0.15 + Math.random() * 0.7);
      alpha = 0.30 + Math.random() * 0.12;
    } else {
      const big = I > 0.62 && Math.random() < 0.25;
      const fx = big ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.4, fy = big ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.4;
      sw = sw0 * fx; sh = sh0 * fy; sx = Math.random() * (sw0 - sw); sy = Math.random() * (sh0 - sh);
      dw = big ? W * (0.7 + Math.random() * 0.3) : W * (0.20 + Math.random() * 0.22);
      dh = dw * sh / sw;
      if (big){ dx = (W - dw) * Math.random(); dy = (H - dh) * Math.random(); }
      else {                                        // ở RÌA, bị cắt mất một phần
        const edge = Math.random();
        if (edge < 0.35){ dx = -dw * (0.25 + Math.random() * 0.4); dy = H * Math.random() - dh / 2; }
        else if (edge < 0.7){ dx = W - dw * (0.6 + Math.random() * 0.4); dy = H * Math.random() - dh / 2; }
        else if (edge < 0.85){ dx = W * Math.random() - dw / 2; dy = -dh * (0.3 + Math.random() * 0.4); }
        else { dx = W * Math.random() - dw / 2; dy = H - dh * (0.55 + Math.random() * 0.4); }
      }
      const a = it.alpha || [0.1, 0.25];
      alpha = (a[0] + Math.random() * (a[1] - a[0])) * (big ? 0.65 : 1) * (0.7 + 0.3 * I);
    }
    this.flashes.push({
      src, sx, sy, sw, sh, dx, dy, dw, dh, alpha, blend: it.blend || 'source-over',
      flip: Math.random() < 0.5, until: t + 0.05 + Math.random() * 0.06,
    });
    this.lastFlash = t;
    if (o.onFlash) o.onFlash(it, distant);
  }

  /* ---------------------------------------------------------------- frame */
  frame(o){
    const { I, t, dt, q, g, rateMul } = o, ctx = this.ctx;
    this._fit(q);
    const W = this.w, H = this.h;
    this._measure(g, t);
    const ar = this.arena;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const I2 = I * I;

    // spawn events -----------------------------------------------------------
    if (I > 0.14 && WEIRDCORE_CONFIG.images && t - this.lastFlash > 1.7 / Math.max(0.6, rateMul) &&
        this._roll((0.03 + 0.19 * Math.pow(I, 1.6)) * q.imgRate * rateMul, dt)) this._spawnFlash(o);
    if (I > 0.40 && this._roll((0.10 + 1.1 * I2) * rateMul, dt)){
      const k = Math.random();
      if (k < 0.45) this.rects.push({ k: 'bar', x: Math.random() * W * 0.6, y: Math.random() * H, w: W * (0.2 + Math.random() * 0.5), h: 1 + Math.random() * 4, a: 0.35 + Math.random() * 0.45, until: t + 0.04 + Math.random() * 0.08 });
      else if (k < 0.75) this.rects.push({ k: 'band', x: 0, y: Math.random() * H, w: W, h: 3 + Math.random() * 10, a: 0.5, until: t + 0.04 + Math.random() * 0.06 });
      else this.rects.push({ k: 'block', x: Math.random() * W * 0.8, y: Math.random() * H * 0.9, w: W * (0.08 + Math.random() * 0.22), h: H * (0.02 + Math.random() * 0.06), a: 0.4 + Math.random() * 0.3, until: t + 0.05 + Math.random() * 0.08 });
    }
    if (I > 0.30 && this.hud.length && this._roll((0.20 + 1.2 * I2) * rateMul, dt)){
      const b = this.hud[Math.floor(Math.random() * this.hud.length)];
      this.ghosts.push({ b, dx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 6) * this.kx * 2, dy: (Math.random() - 0.5) * 6 * this.ky * 2, until: t + 0.06 + Math.random() * 0.10 });
    }
    if (I > 0.5 && this._roll((0.02 + 0.25 * I2) * rateMul, dt)){ this.dark.until = t + 0.03 + Math.random() * 0.03; this.dark.a = 0.35 + Math.random() * 0.4; }

    // 1) NGOÀI sân đấu (không đụng vào sân và các khối HUD): nền tối dần + đám "???" trôi.
    //    Vẽ đầy màn hình rồi khoét sân/HUD ra => gameplay và UI luôn đọc được.
    if (I > 0.06){
      ctx.fillStyle = 'rgba(0,0,0,' + (0.66 * Math.pow(I, 1.15)).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      if (I > 0.40){
        const src = this.swarmSrc || (this.swarmSrc = (o.imgs.pick(I, WEIRDCORE_SWARM_KIND) || {}).src || null);
        if (src){
          if (t - this.swarmT > 0.22){
            this.swarmT = t;
            const sw0 = src.naturalWidth || src.width, sh0 = src.naturalHeight || src.height, f = 0.5 + Math.random() * 0.5;
            this.swarmCrop = { sx: Math.random() * sw0 * (1 - f), sy: Math.random() * sh0 * (1 - f), sw: sw0 * f, sh: sh0 * f, jx: (Math.random() - 0.5) * 4 };
          }
          const c = this.swarmCrop;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.07 + 0.15 * clamp((I - 0.40) / 0.60, 0, 1) * (0.75 + 0.25 * Math.sin(t * 2.3));
          ctx.drawImage(src, c.sx, c.sy, c.sw, c.sh, c.jx, 0, W, H);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        }
      }
      if (ar) ctx.clearRect(ar.x, ar.y, ar.w, ar.h);
      for (const b of this.hud) ctx.clearRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    }

    // 2) drain đồng đều nhẹ + vignette
    const drain = 0.24 * I2;
    if (drain > 0.004){ ctx.fillStyle = 'rgba(0,0,0,' + drain.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = clamp(0.14 + 0.86 * Math.pow(I, 1.1), 0, 1);
    ctx.drawImage(this.vig, 0, 0);
    ctx.globalAlpha = 1;

    // 3) vùng tối bất thường (đa giác méo, đậm nhạt chậm)
    if (I > 0.22){
      ctx.fillStyle = '#000';
      for (const r of this.regions){
        const wave = 0.5 + 0.5 * Math.sin(t * r.sp + r.ph), a = I * 0.24 * wave * wave;
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.moveTo(r.pts[0][0], r.pts[0][1]);
        for (let i = 1; i < r.pts.length; i++) ctx.lineTo(r.pts[i][0], r.pts[i][1]);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 4) mắt nhìn từ rìa -------------------------------------------------------
    if (I > 0.26){
      const target = Math.round(clamp((I - 0.26) / 0.74, 0, 1) * q.eyes);
      this.eyes = this.eyes.filter(e => t < e.born + e.life);
      if (this.eyes.length < target && this._roll(0.9, dt)) this._spawnEye(t, I);
      const foc = o.focus;
      for (const e of this.eyes){
        const age = t - e.born, env = Math.min(1, age / 0.9, (e.life - age) / 0.7);
        const blink = ((age + e.ph) % e.per) < 0.13 ? 0.08 : 1;
        let lx = 0, ly = 0;
        if (foc){ const dx = foc.x - e.x, dy = foc.y - e.y, d = Math.hypot(dx, dy) || 1; lx = dx / d; ly = dy / d; }
        drawWeirdEye(ctx, e.x, e.y, e.w, clamp(env, 0, 1) * blink, lx, ly, (0.16 + 0.44 * I) * clamp(env, 0, 1));
      }
    }

    // 5) noise + scanline + dải cuộn ------------------------------------------
    const nA = 0.012 + 0.10 * Math.pow(I, 1.4);
    if (this.noise.length){
      const tile = this.noise[(Math.random() * Math.min(q.noiseTiles, this.noise.length)) | 0], ox = (Math.random() * 64) | 0, oy = (Math.random() * 64) | 0;
      ctx.save(); ctx.translate(-ox, -oy); ctx.globalAlpha = nA; ctx.fillStyle = tile; ctx.fillRect(0, 0, W + 64, H + 64); ctx.restore();
    }
    ctx.globalAlpha = 0.015 + 0.06 * I; ctx.fillStyle = this.scanPat; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    if (I > 0.4){
      const by = ((t * 0.11) % 1.3 - 0.15) * H, bh = H * 0.12;
      const g2 = ctx.createLinearGradient(0, by, 0, by + bh); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, by, W, bh);
    }

    // 6) thanh / khối nhiễu -----------------------------------------------------
    if (this.rects.length){
      this.rects = this.rects.filter(r => t < r.until);
      for (const r of this.rects){
        if (r.k === 'band' && this.noise.length){ ctx.globalAlpha = r.a; ctx.fillStyle = this.noise[0]; ctx.fillRect(r.x, r.y, r.w, r.h); }
        else { ctx.globalAlpha = r.a; ctx.fillStyle = '#000'; ctx.fillRect(r.x, r.y, r.w, r.h); }
      }
      ctx.globalAlpha = 1;
    }

    // 7) bóng ma của UI (khối HUD bị nhân đôi, lệch vài px) --------------------------
    if (this.ghosts.length){
      this.ghosts = this.ghosts.filter(gh => t < gh.until);
      for (const gh of this.ghosts){
        ctx.globalAlpha = 0.22; ctx.fillStyle = '#000'; ctx.fillRect(gh.b.x + gh.dx, gh.b.y + gh.dy, gh.b.w, gh.b.h);
        ctx.globalAlpha = 0.35; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(gh.b.x - gh.dx * 0.6, gh.b.y - gh.dy, gh.b.w, gh.b.h);
      }
      ctx.globalAlpha = 1;
    }

    // 8) hình weirdcore chớp -------------------------------------------------------
    if (this.flashes.length){
      this.flashes = this.flashes.filter(f => t < f.until);
      for (const f of this.flashes){
        ctx.save();
        ctx.globalCompositeOperation = f.blend; ctx.globalAlpha = f.alpha;
        if (f.flip){ ctx.translate(f.dx + f.dw, f.dy); ctx.scale(-1, 1); ctx.drawImage(f.src, f.sx, f.sy, f.sw, f.sh, 0, 0, f.dw, f.dh); }
        else ctx.drawImage(f.src, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh);
        ctx.restore();
      }
    }

    // 9) chớp đen / cú giật đổi stage ---------------------------------------------------
    let dk = 0;
    if (t < this.dark.until) dk = this.dark.a;
    if (this.pulseA > 0.01){ dk = Math.max(dk, this.pulseA); this.pulseA *= Math.exp(-dt * 14); } else this.pulseA = 0;
    if (dk > 0){ ctx.globalAlpha = Math.min(0.9, dk); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  /* ------------------------------------------------ post-fx lên canvas game */
  _scratch(w, h){
    const key = w + 'x' + h;
    if (key !== this.sKey){
      this.sKey = key;
      this.sA = wcCanvas(w, h); this.sR = wcCanvas(w, h); this.sC = wcCanvas(w, h);
    }
  }

  postGame(g, I, t, dt, q, rateMul){
    if (I < 0.25) return;
    const cv = g.canvas, W = cv.width, H = cv.height, ctx = g.ctx, px = g.pxScale || 1;
    // -- xé hình: vài dải ngang bị dịch sang bên
    if (t > this.tear.until && this._roll((0.10 + 1.15 * I * I) * rateMul, dt)){
      const n = 1 + Math.floor(Math.random() * q.strips), strips = [];
      for (let i = 0; i < n; i++) strips.push({ y: Math.random() * H * 0.92, h: (6 + Math.random() * 22) * px, dx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 11) * px * (0.5 + I) });
      this.tear.strips = strips; this.tear.until = t + 0.05 + Math.random() * 0.08;
    }
    // -- lệch màu RGB nháy ngắn (chỉ mức HIGH)
    if (q.chroma && I > 0.35 && t > this.chroma.until && this._roll((0.25 + 1.6 * I * I) * rateMul, dt)){
      this.chroma.until = t + 0.07 + Math.random() * 0.15; this.chroma.amt = (1.2 + Math.random() * 1.6) * (0.5 + I) * px;
    }
    const tearOn = t < this.tear.until, chromaOn = q.chroma && t < this.chroma.until;
    if (!tearOn && !chromaOn) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    this._scratch(W, H);
    if (tearOn){
      const s = this.sA.getContext('2d');
      for (const st of this.tear.strips){
        const sy = Math.max(0, Math.floor(st.y)), sh = Math.min(Math.ceil(st.h), H - sy);
        if (sh < 1) continue;
        s.clearRect(0, 0, W, sh); s.drawImage(cv, 0, sy, W, sh, 0, 0, W, sh);
        ctx.drawImage(this.sA, 0, 0, W, sh, st.dx, sy, W, sh);
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, sy, W, Math.max(1, px * 0.6)); ctx.globalAlpha = 1;
      }
    }
    if (chromaOn){
      const a = this.sA.getContext('2d'), r = this.sR.getContext('2d'), c = this.sC.getContext('2d'), d = Math.round(this.chroma.amt);
      a.globalCompositeOperation = 'copy'; a.drawImage(cv, 0, 0);
      r.globalCompositeOperation = 'copy'; r.drawImage(this.sA, 0, 0); r.globalCompositeOperation = 'multiply'; r.fillStyle = '#ff0000'; r.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'copy'; c.drawImage(this.sA, 0, 0); c.globalCompositeOperation = 'multiply'; c.fillStyle = '#00ffff'; c.fillRect(0, 0, W, H);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.sR, d, 0); ctx.drawImage(this.sC, -d, 0);
      a.globalCompositeOperation = 'source-over'; r.globalCompositeOperation = 'source-over'; c.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
}
