/* ============================================================================
   THE WEIRDCORE?!  -  director.js
   ----------------------------------------------------------------------------
   * Định nghĩa Ball "The Weirdcore?!" (đăng ký vào BALL_TYPES như mọi Ball khác)
   * WeirdQuality  : tự chỉnh LOW/MEDIUM/HIGH theo FPS
   * WeirdcoreDirector (singleton `Weirdcore`): điều phối AnxietySystem, MadnessSystem,
     ScreenDistortion, ảnh, âm thanh, HUD, debug. Engine chỉ gọi vài hook nhỏ:

       engine.start()          -> Weirdcore.onMatchStart(g)
       engine.stop()           -> Weirdcore.onMatchStop(g)
       engine.endMatch()       -> Weirdcore.onMatchEnd(g)
       engine._updateWorld     -> Weirdcore.movementHook(ball, localDt, dt, g)
       engine._postStep        -> giảm sát thương (state.anxDmgMult) + Weirdcore.afterHUD(g)
       engine.render           -> def.drawBody, Weirdcore.beginBall/endBall, Weirdcore.postRender
       Ball.currentMods        -> nhân state.anxSpeedMult vào tốc độ

   Nếu có lỗi bất ngờ trong effect, Weirdcore tự TẮT (Weirdcore.fail) thay vì làm sập game.
   ========================================================================== */

class WeirdQuality {
  constructor(cfg){
    this.cfg = cfg; this.mode = 'AUTO'; this.level = 'HIGH';
    this.ema = 16.7; this.last = 0; this.bad = 0; this.good = 0; this.cool = 0; this.fps = 60;
  }
  init(){
    const m = String(this.cfg.quality || 'auto').toUpperCase();
    this.mode = WEIRDCORE_QUALITY[m] ? m : 'AUTO';
    if (this.mode === 'AUTO') this.level = (typeof DEVICE !== 'undefined' && DEVICE.isPhone) ? 'MEDIUM' : 'HIGH';
    else this.level = this.mode;
    this.last = 0; this.bad = 0; this.good = 0; this.cool = 2;
  }
  get q(){ return WEIRDCORE_QUALITY[this.level]; }
  label(short){ return this.mode === 'AUTO' ? (short ? 'auto' : 'auto→' + this.level) : this.level; }
  cycle(){
    const order = ['AUTO', 'LOW', 'MEDIUM', 'HIGH'];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    if (this.mode !== 'AUTO') this.level = this.mode;
    this.cfg.quality = this.mode;
  }
  frame(nowMs){
    let d = 0;
    if (this.last){ d = nowMs - this.last; if (d < 250) this.ema += (d - this.ema) * 0.05; }
    this.last = nowMs; this.fps = 1000 / this.ema;
    if (this.mode !== 'AUTO' || !d || d >= 250) return;
    const s = d / 1000; this.cool -= s;
    const i = WEIRDCORE_QUALITY_ORDER.indexOf(this.level);
    if (this.ema > 24.5){ this.bad += s; this.good = 0; }
    else if (this.ema < 18.5){ this.good += s; this.bad = 0; }
    else { this.bad = 0; this.good = 0; }
    if (this.bad > 1.2 && this.cool <= 0 && i > 0){ this.level = WEIRDCORE_QUALITY_ORDER[i - 1]; this.bad = 0; this.cool = 3; this.ema = 16.7; }
    else if (this.good > 7 && this.cool <= 0 && i < 2){ this.level = WEIRDCORE_QUALITY_ORDER[i + 1]; this.good = 0; this.cool = 6; }
  }
}

/* -------------------------------------------------------------------------- */

class WeirdcoreDirector {
  constructor(){
    this.cfg = WEIRDCORE_CONFIG;
    this.anxiety = new AnxietySystem(this.cfg);
    this.madness = new MadnessSystem(this.cfg);
    this.screen = new ScreenDistortion();
    this.images = new WeirdImages(this.cfg, WEIRDCORE_IMAGES);
    this.audio = new WeirdAudio();
    this.hud = new WeirdHud();
    this.debugUI = new WeirdDebug(this);
    this.quality = new WeirdQuality(this.cfg);
    this.g = null; this.active = false; this.failed = false;
    this.sources = []; this.primary = null; this.nameFx = {};
    this.I = 0; this.ending = false; this.endT = 0; this.frameNo = 0;
    this.dbg = { stage: null, timeScale: 1 };
    this.debugUI.mount();
  }

  fail(e){
    if (this.failed) return;
    this.failed = true;
    console.error('[Weirdcore] tự tắt do lỗi:', e);
    try { this.cleanup(this.g); if (this.g && this.g.balls) this.g.balls.forEach(b => this.anxiety.clear(b)); } catch (_) {}
  }

  /* --------------------------------------------------------- vòng đời trận */
  initSource(b){
    b.state.wc = { stacks: 0, sm: 0, acc: 0, lastT: null, stage: 0, frozen: false, selfI: 0, ev: null };
  }

  onMatchStart(g){
    try {
      this.cleanup(g);
      this.g = g;
      this.sources = g.balls.filter(b => b.def && b.def.weird);
      this.primary = this.sources[0] || null;
      this.active = this.sources.length > 0 && !this.failed;
      if (!this.active) return;
      this.I = 0; this.ending = false; this.dbg.stage = null; this.dbg.timeScale = 1;
      this.quality.init(); this.images.init();
      this.screen.attach(); this.screen.setVisible(true);
      this.audio.start();
      this.debugUI.show(true); this.debugUI.refresh(true);
      document.body.classList.add('wc-active');
      for (const b of this.sources){
        const el = document.getElementById('p' + b.player + 'NameLbl');
        if (el) this.nameFx[b.player] = new WeirdcoreEffect(el);
      }
    } catch (e){ this.fail(e); }
  }

  onMatchStop(g){ try { this.cleanup(g || this.g, true); } catch (e){ this.fail(e); } }

  onMatchEnd(g){
    if (!this.active) return;
    this.ending = true; this.endT = g.fxT;
    this.audio.stop();
    for (const p in this.nameFx) this.nameFx[p].restore();
    this.nameFx = {};
    this.hud.reset(g);
  }

  cleanup(g, clearVictims){
    for (const p in this.nameFx) this.nameFx[p].restore();
    this.nameFx = {};
    this.hud.reset(g);
    this.screen.setVisible(false);
    this.audio.stop();
    this.debugUI.show(false);
    document.body.classList.remove('wc-active');
    if (clearVictims && g && g.balls) g.balls.forEach(b => this.anxiety.clear(b));
    this.active = false; this.sources = []; this.primary = null; this.ending = false;
  }

  finish(g){
    this.screen.setVisible(false);
    this.debugUI.show(false);
    document.body.classList.remove('wc-active');
    this.active = false;
  }

  /* -------------------------------------------------------------- gameplay */
  // gọi từ def.update của The Weirdcore (chỉ chạy khi powerOk => Powerless Ball làm nó ngừng "tích"
  // tầng - đó là counter tự nhiên).
  tickSource(b, dt, g){
    if (this.failed) return;
    try {
      const W = b.state.wc, foe = g.opponentOf(b), cfg = this.cfg;
      if (W.lastT == null) W.lastT = g.t;
      const d = clamp(g.t - W.lastT, 0, 0.05);           // thời gian GAME thật, không phụ thuộc slow/stun
      W.lastT = g.t;
      if (!W.frozen && foe && foe.alive){
        W.acc += d * this.dbg.timeScale;
        while (W.acc >= cfg.stackInterval && W.stacks < cfg.maxStacks){
          W.acc -= cfg.stackInterval; W.stacks++;
          this._onStack(b, W);
        }
        if (W.stacks >= cfg.maxStacks) W.acc = 0;
      }
      // đốt máu từ Madness trở lên (kể cả khi đang khoá stage bằng debug, để test được)
      const bc = cfg.burn;
      if (bc && foe && foe.alive && foe.hp > 0 && this.anxiety.stageOf(W.stacks) >= bc.fromStage){
        W.burnAcc = (W.burnAcc || 0) + d * this.dbg.timeScale;
        while (W.burnAcc >= bc.every && foe.hp > 0){
          W.burnAcc -= bc.every;
          foe.hp = Math.max(0, foe.hp - bc.hp);
          foe.state.wcBurn = true;                       // engine._postStep: hiệu ứng nhẹ, không rung màn hình
          spawnFloatText(g, foe.x, foe.y - foe.radius - 8, '-' + bc.hp, '#1a1a1a');
        }
      } else W.burnAcc = 0;
      W.sm += (W.stacks - W.sm) * Math.min(1, d * 2.5);   // nội suy mượt ~0.4s giữa các tầng
      W.selfI = clamp(W.sm / cfg.maxStacks, 0, 1);
      if (foe) this.anxiety.apply(foe, W.sm, W.stacks);
    } catch (e){ this.fail(e); }
  }

  _onStack(b, W){
    const st = this.anxiety.stageOf(W.stacks);
    if (st > W.stage){
      W.stage = st;
      this.screen.pulse(0.30 + 0.08 * st);
      this.audio.swell(st);
      for (const p in this.nameFx) this.nameFx[p].burst(this.g ? this.g.fxT : 0, 0.7);
    }
  }

  // hook trong _updateWorld: xoay hướng / khựng / kéo dài hồi chiêu cho nạn nhân
  movementHook(ball, localDt, dt, g){
    const s = ball.state;
    if (!(s.anxStage > 0) || this.failed) return localDt;
    try {
      this.anxiety.dragCooldowns(ball, dt, g);
      if (s.anxStage >= 2 && this.madness.eligible(ball)){
        this.madness.steer(ball, dt, g);
        if (this.madness.frozen(ball, g)) return 0;
      }
    } catch (e){ this.fail(e); }
    return localDt;
  }

  // không bao giờ để ball rời arena (an toàn thêm, ngoài resolveWallCollision của engine)
  clampArena(ball, g){
    if (!(ball.state.anxStage >= 2)) return;
    const r = ball.radius;
    ball.x = clamp(ball.x, r, g.w - r);
    ball.y = clamp(ball.y, r, g.h - r);
  }

  /* ----------------------------------------------------------------- debug */
  // mã bí mật ANXIETY (ui.js) bật/tắt bảng debug. Trả về trạng thái mới.
  setDebugUnlocked(v){
    WEIRDCORE_DEBUG = v; this.cfg.debug = v;
    if (!v){ this.dbg.timeScale = 1; if (this.g) this.setDebugStage(null); }
    if (this.active) this.debugUI.show(v);
    return v;
  }

  setDebugStage(k){
    const g = this.g;
    if (!g) return;
    if (k == null){ this.dbg.stage = null; this.sources.forEach(s => { s.state.wc.frozen = false; }); return; }
    this.dbg.stage = k;
    const stacks = k <= 4 ? this.cfg.stageAt[k] : this.cfg.maxStacks;
    for (const s of this.sources){
      const W = s.state.wc;
      W.stacks = stacks; W.sm = stacks; W.acc = 0; W.frozen = true; W.stage = this.anxiety.stageOf(stacks); W.selfI = clamp(stacks / this.cfg.maxStacks, 0, 1);
      const foe = g.opponentOf(s);
      if (foe){ if (stacks > 0) this.anxiety.apply(foe, stacks, stacks); else this.anxiety.clear(foe); }
    }
    this.screen.pulse(0.4); this.audio.swell(Math.min(4, k));
  }

  debugFlash(){
    if (!this.g) return;
    this.screen._spawnFlash({ I: 0.95, t: this.g.fxT, imgs: this.images, q: this.quality.q, onFlash: () => this.audio.reversed(0.7) });
  }

  debugUiGlitch(){
    const g = this.g; if (!g) return;
    for (const p in this.nameFx) this.nameFx[p].burst(g.fxT, 1.2);
    g.balls.forEach(b => { if ((b.state.anxStage | 0) > 0) this.hud.force(b.player); });
    this.audio.uiGlitch();
  }

  /* ---------------------------------------------------------- render hooks */
  computeI(){
    let m = 0;
    for (const s of this.sources) m = Math.max(m, s.state.wc.sm / this.cfg.maxStacks);
    return clamp(m, 0, 1);
  }

  postRender(g, dt){
    if (!this.active || this.failed) return;
    try {
      this.quality.frame(performance.now());
      const q = this.quality.q, t = g.fxT;
      let fade = 1;
      if (this.ending){ fade = clamp(1 - (t - this.endT) / 1.0, 0, 1); if (fade <= 0){ this.finish(g); return; } }
      const I = this.computeI() * fade;
      this.I = I;
      const rateMul = this.dbg.stage === 5 ? 2 : 1;
      this.screen.postGame(g, I, t, dt, q, rateMul);
      this.frameNo++;
      if (this.frameNo % q.ovEvery === 0){
        let focus = null;
        const ar = this.screen.arena, foe = this.primary && g.opponentOf(this.primary);
        if (ar && foe) focus = { x: ar.x + foe.x / g.w * ar.w, y: ar.y + foe.y / g.h * ar.h };
        this.screen.frame({ I, t, dt: dt * q.ovEvery, q, g, imgs: this.images, rateMul, focus, onFlash: () => this.audio.reversed(I) });
      }
      const nI = clamp(0.08 + 0.92 * Math.pow(I, 0.75), 0, 1) * (fade < 1 ? fade : 1);
      for (const p in this.nameFx) if (this.nameFx[p].update(nI, t)) this.audio.uiGlitch();
      this.audio.update(I, dt);
      this.debugUI.refresh();
    } catch (e){ this.fail(e); }
  }

  afterHUD(g){
    if (!this.active || this.failed) return;
    try {
      const victims = g.balls.filter(b => (b.state.anxStage | 0) > 0);
      if (victims.length || this.hud.status.until) this.hud.after(g, victims, this.I, this.audio);
    } catch (e){ this.fail(e); }
  }

  // rung + afterimage của nạn nhân (chỉ hiệu ứng vẽ). Trả true nếu đã ctx.save().
  beginBall(ball, g, ctx){
    if (!(ball.state.anxShake > 0.01) || this.failed) return false;
    const V = this.madness.visual(ball, g);
    if (!V) return false;
    ctx.save();
    if (V.after > g.fxT){
      const col = ball.bodyColorOverride || ball.def.color || ball.color;
      ctx.globalAlpha = 0.16; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(ball.x + V.ax, ball.y + V.ay, ball.radius, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.09;
      ctx.beginPath(); ctx.arc(ball.x - V.ax * 0.7, ball.y - V.ay * 0.7, ball.radius, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.translate(ball.x + V.dx, ball.y + V.dy); ctx.rotate(V.rot); ctx.scale(V.sc, V.sc); ctx.translate(-ball.x, -ball.y);
    return true;
  }

  // tên "The Weirdcore?!" trong thư viện / màn chọn bóng: hiệu ứng CSS nhẹ (.wc-title, xem weirdcore.css)
  decorateUi(){
    document.querySelectorAll('#galleryCards .info b, #galleryDetail .gallery-detail-name, #p1Summary b, #p2Summary b').forEach(el => {
      if (el.textContent.indexOf('The Weirdcore?!') >= 0) el.classList.add('wc-title');
    });
  }

  /* --------------------------------------------- THE WEIRDCORE?! - thân bóng */
  _voidEvents(b, g){
    const W = b.state.wc, T = g.fxT, k = W.selfI;
    if (!W.ev) W.ev = { kind: '', until: 0, next: T + 3 + Math.random() * 3, ox: 0, oy: 0, sx: 1, sy: 1, a: 0, b0: 0, b1: 0 };
    const E = W.ev;
    if (E.kind && T >= E.until) E.kind = '';
    if (!E.kind && T >= E.next && g.phase === 'sim'){
      const pool = k < 0.25 ? ['shift', 'dup', 'stretch'] : ['shift', 'dup', 'stretch', 'cut', 'eye'];
      E.kind = pool[(Math.random() * pool.length) | 0];
      E.until = T + 0.05 + Math.random() * 0.07;
      E.ox = (Math.random() - 0.5) * 10; E.oy = (Math.random() - 0.5) * 7;
      E.sx = E.kind === 'stretch' && Math.random() < 0.5 ? 1.3 + Math.random() * 0.2 : 1;
      E.sy = E.kind === 'stretch' && E.sx === 1 ? 1.3 + Math.random() * 0.2 : 1;
      E.a = Math.random() * 6.2832; E.b0 = (Math.random() - 0.5) * 0.9; E.b1 = E.b0 + 0.18 + Math.random() * 0.2;
      E.next = T + (5.5 + Math.random() * 5.5) / (0.7 + 1.5 * k);
    }
    return E;
  }

  _voidPath(ctx, x, y, R, T, wob, spike){
    const N = 32;
    ctx.beginPath();
    for (let i = 0; i < N; i++){
      const a = i / N * 6.2832;
      let r = R * (1 + wob * (Math.sin(a * 3 + T * 1.7) * 0.6 + Math.sin(a * 5 - T * 2.3 + 1.3) * 0.4));
      if (spike && ((i * 7 + Math.floor(T * 20)) % 11) === 0) r *= 1 + spike;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  drawVoidBall(b, g, ctx, info){
    const W = b.state.wc, T = g.fxT, R = b.radius * (info.pop || 1), x = b.x, y = b.y, k = W ? W.selfI : 0;
    const E = this._voidEvents(b, g);
    const flash = info.flashT || 0;

    // 1) ánh sáng xung quanh bị HÚT VÀO: quầng tối + vài vạch mảnh trôi vào tâm
    const hr = R * (2.3 + 0.5 * k);
    const gr = ctx.createRadialGradient(x, y, R * 0.9, x, y, hr);
    gr.addColorStop(0, 'rgba(0,0,0,' + (0.20 + 0.12 * k).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, hr, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,' + (0.10 + 0.08 * k).toFixed(2) + ')'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 9; i++){
      const a = i * 0.698 + T * 0.12, ph = (T * 0.55 + i * 0.137) % 1, d = R * (2.4 - 1.35 * ph);
      ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      ctx.lineTo(x + Math.cos(a) * (d - R * 0.28), y + Math.sin(a) * (d - R * 0.28));
    }
    ctx.stroke();

    // 2) bóng KHÔNG tự nhiên: lệch lên trên, trôi chậm, đôi lúc tách rời, đôi lúc có bóng thứ hai
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(x + Math.sin(T * 0.31 + 1.3) * R * 0.6, y - R * (0.35 + 0.25 * Math.sin(T * 0.23)), R * 0.95, R * 0.34, 0, 0, 6.2832); ctx.fill();
    if (k > 0.3){
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.ellipse(x - Math.cos(T * 0.27) * R * 0.9, y + R * 1.05, R * 0.7, R * 0.22, 0, 0, 6.2832); ctx.fill();
    }

    // 3) thân bóng: đen thẳm, viền rung, silhouette lệch/kéo giãn theo sự kiện
    ctx.save();
    let ox = 0, oy = 0;
    if (E.kind === 'shift'){ ox = E.ox; oy = E.oy; }
    if (E.kind === 'stretch'){ ctx.translate(x, y); ctx.scale(E.sx, E.sy); ctx.translate(-x, -y); }
    if (E.kind === 'cut'){                                       // một dải ngang của bóng biến mất
      const y0 = y + E.b0 * R * 2, y1 = y0 + (E.b1 - E.b0) * R * 2;
      ctx.beginPath(); ctx.rect(x - R * 3, y - R * 3, R * 6, y0 - (y - R * 3)); ctx.rect(x - R * 3, y1, R * 6, y + R * 3 - y1); ctx.clip();
    }
    const wob = 0.02 + 0.03 * k, cx = x + ox, cy = y + oy;
    const drawBody = (bx, by, a) => {
      const px = bx + Math.sin(T * 0.8) * R * 0.16, py = by + Math.cos(T * 0.63) * R * 0.13;
      const g1 = ctx.createRadialGradient(px, py, 0, bx, by, R * 1.05);
      g1.addColorStop(0, '#000'); g1.addColorStop(0.5, '#020203'); g1.addColorStop(0.85, '#08080b'); g1.addColorStop(1, '#14141c');
      ctx.globalAlpha = a; ctx.fillStyle = g1;
      this._voidPath(ctx, bx, by, R, T, wob, flash * 0.10);
      ctx.fill(); ctx.globalAlpha = 1;
    };
    if (E.kind === 'dup') drawBody(cx + (E.ox > 0 ? 7 : -7), cy + E.oy * 0.6, 0.5);
    drawBody(cx, cy, 1);
    // viền nhợt rất mờ + vòng màu người chơi (để vẫn nhận ra ball của ai)
    ctx.strokeStyle = 'rgba(120,120,140,0.26)'; ctx.lineWidth = 1; this._voidPath(ctx, cx, cy, R, T, wob, 0); ctx.stroke();
    ctx.strokeStyle = rgba(b.color, 0.55); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R + 1.5, 0, 6.2832); ctx.stroke();
    if (flash > 0.02){
      ctx.fillStyle = 'rgba(70,70,90,' + (flash * 0.5).toFixed(2) + ')'; this._voidPath(ctx, cx, cy, R, T, wob, flash * 0.10); ctx.fill();
      ctx.strokeStyle = 'rgba(235,235,250,' + (flash * 0.8).toFixed(2) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, 6.2832); ctx.stroke();
    }
    // 4) một con mắt ở CHỖ KHÔNG ĐÚNG, vài frame
    if (E.kind === 'eye'){
      const foe = g.opponentOf(b);
      let lx = 0, ly = 0;
      if (foe){ const dx = foe.x - x, dy = foe.y - y, d = Math.hypot(dx, dy) || 1; lx = dx / d; ly = dy / d; }
      drawWeirdEye(ctx, cx + Math.cos(E.a) * R * 0.42, cy + Math.sin(E.a) * R * 0.42, R * 0.72, 1, lx, ly, 0.62);
    }
    ctx.restore();
  }
}

const Weirdcore = new WeirdcoreDirector();

/* -------------------------------------------------------------------------- */
/* ĐĂNG KÝ BALL - xuất hiện trong danh sách chọn như các Ball khác             */
const WEIRDCORE_BALL = {
  id: 'weirdcore', name: 'The Weirdcore?!', group: 'special', icon: '👁️',
  hp: 85, speed: 92, dmg: 7, color: '#050507',
  weird: true, hideIcon: true, shape: 'circle',
  descSimple: 'Một quả bóng đen thẳm, nhìn lâu thấy bất an. Cứ mỗi 2 giây, đối thủ lại "không ổn" thêm một chút: chậm dần, yếu dần, rồi mất kiểm soát. Trận càng kéo dài, cả màn hình càng không đúng.',
  desc: 'Bản thân yếu (HP thấp, đánh nhẹ) nhưng <b>mạnh dần theo thời gian</b>. Mỗi <b>2 giây</b> đối thủ nhận thêm 1 tầng <b>bất an</b> (tối đa 26 tầng ≈ 52s). Tầng càng cao: tốc độ ↓, mọi sát thương đối thủ gây ra ↓, hồi chiêu / nhịp kỹ năng chậm lại, đường đi bắt đầu lệch. ' +
        '<br><b>~6s</b> Uneasy (×0.97 tốc độ, ×0.96 sát thương, hồi chiêu ×1.08) · <b>~14s</b> Disturbed (×0.91 / ×0.90 / ×1.25, hướng đi trôi nhẹ) · <b>~24s</b> Panic (×0.80 / ×0.78 / ×1.6, rung, hay quặt hướng) · <b>~36s</b> Madness (×0.68 / ×0.65 / ×2.0, đảo hướng bất ngờ). Đỉnh: ×0.60 / ×0.55 / ×2.4 — không bao giờ tệ hơn. ' +
        '<br><b>Từ Madness trở đi</b> đối thủ còn bị <b>đốt máu 1 HP mỗi 0.3s</b> (có thể chết vì nó). ' +
        '<br>Không teleport, không xuyên tường. Đối thủ dùng Powerless Ball làm nó ngừng tích tầng. Kèm hiệu ứng màn hình, UI và âm thanh riêng — càng về sau càng "sai".',
  init: (b) => { Weirdcore.initSource(b); },
  update: (b, dt, g) => { Weirdcore.tickSource(b, dt, g); },
  drawBody: (b, g, ctx, info) => { Weirdcore.drawVoidBall(b, g, ctx, info); },
};
BALL_TYPES.push(WEIRDCORE_BALL);
