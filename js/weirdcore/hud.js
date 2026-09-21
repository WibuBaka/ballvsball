/* ============================================================================
   THE WEIRDCORE?!  -  hud.js
   ----------------------------------------------------------------------------
   WeirdcoreEffect : chữ TÊN "The Weirdcore?!" trên thanh HP dần "hỏng" theo cường độ
   WeirdHud        : UI của ĐỐI THỦ (số HP, tên, khung HP, dòng trạng thái) thỉnh thoảng glitch
   WeirdDebug      : bảng debug nhỏ (phím 1-6 / nút WC) để test từng stage

   Quy tắc: giá trị gameplay luôn ĐÚNG. Glitch chỉ là chữ/vị trí hiển thị vài frame;
   engine.updateHUD() ghi lại số thật mỗi frame nên mọi thứ tự trở về đúng.
   Không thêm DOM mới mỗi frame - chỉ sửa style của vài span có sẵn.
   ========================================================================== */

// ký tự "na ná" cho homoglyph (chữ cái nhìn gần giống nhưng SAI)
const WC_HOMOGLYPH = { W: 'VV', e: 'ε', i: 'ı', r: 'г', d: 'ď', c: 'ϲ', o: '0', '?': '¿', '!': 'ǃ', T: 'Ͳ', h: 'ħ' };
const WC_DIGIT_GLITCH = { '0': 'O', '1': 'l', '5': 'S', '8': 'B', '6': 'b', '3': 'E', '2': 'Z' };

class WeirdcoreEffect {
  constructor(el){
    this.el = el;
    this.orig = el.textContent;
    this.chars = Array.from(this.orig);
    this.st = this.chars.map(() => ({ dx: 0, dy: 0, sx: 1, sy: 1, op: 1, col: '', clip: '', hide: 0, sub: '', until: 0, css: '' }));
    this.spans = [];
    this.last = 0; this.burstUntil = 0; this.ghostUntil = 0;
    el.textContent = '';
    el.classList.add('wc-name');
    el.setAttribute('data-t', this.orig);
    this.chars.forEach(ch => {
      const s = document.createElement('span');
      s.className = 'wc-ch';
      s.textContent = ch === ' ' ? '\u00a0' : ch;
      el.appendChild(s); this.spans.push(s);
    });
  }

  burst(now, dur){ this.burstUntil = Math.max(this.burstUntil, now + dur); }

  // n = cường độ 0..1. Trả về true nếu vừa có 1 sự kiện "nặng" (để bật tiếng UI méo)
  update(n, now){
    if (now - this.last < 0.077) return false;         // ~13 Hz: kiểu khung hình hỏng, cũng nhẹ CPU
    const dtk = now - this.last; this.last = now;
    if (now < this.burstUntil) n = Math.min(1, n + 0.35);
    const per = 1 / 13, amp = 0.12 + 1.9 * n, pJ = 0.04 + 0.34 * n;
    let heavy = false;
    const N = this.chars.length;
    const p = (rate) => Math.random() < rate * per;

    // sự kiện cấp tên
    if (n > 0.15 && p(0.02 + 0.25 * n)){                       // một đoạn chữ biến mất rồi quay lại
      const a = (Math.random() * N) | 0, l = 2 + ((Math.random() * 3) | 0), dur = now + 0.3 + Math.random() * 0.6;
      for (let i = a; i < Math.min(N, a + l); i++) this.st[i].hide = dur;
      heavy = true;
    }
    if (p(0.10 + 1.2 * n)) this.ghostUntil = now + 0.08 + Math.random() * 0.15;
    const ghostOn = now < this.ghostUntil;
    this.el.style.setProperty('--go', ghostOn ? (0.25 + 0.25 * n).toFixed(2) : '0');
    if (ghostOn && this._gx === undefined){ this._gx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3); this.el.style.setProperty('--gx', this._gx.toFixed(1) + 'px'); }
    if (!ghostOn) this._gx = undefined;
    this.el.style.setProperty('--sh', (0.5 + 2.2 * n).toFixed(1) + 'px');     // bóng đen sau chữ đậm dần

    for (let i = 0; i < N; i++){
      const s = this.st[i];
      if (this.chars[i] === ' ') continue;
      // reset mỗi tick, rồi áp lại
      s.dx = 0; s.dy = 0; s.sx = 1; s.sy = 1; s.op = 1; s.col = ''; s.clip = ''; s.sub = '';
      if (Math.random() < pJ){ s.dx = (Math.random() * 2 - 1) * amp; s.dy = (Math.random() * 2 - 1) * amp * 1.2; }
      if (p(0.20 + 3 * n)) s.op = 0.2 + Math.random() * 0.3;                      // nhấp nháy
      if (p(0.20 + 1.2 * n)) s.col = '#000';                                       // tối bất thường
      else if (p(0.15 + 1.0 * n)) s.col = '#b9b9b4';                               // nhạt bất thường
      if (n > 0.25 && p(0.10 + 1.6 * n)){                                          // kéo giãn vài frame
        if (Math.random() < 0.6) s.sx = 1.5 + Math.random() * 0.9; else s.sy = 1.4 + Math.random() * 0.5;
      }
      if (p(0.10 + 1.2 * n)){                                                      // mất "pixel": cắt nửa ký tự
        const k = Math.random();
        s.clip = k < 0.34 ? 'inset(0 0 55% 0)' : k < 0.67 ? 'inset(45% 0 0 0)' : 'inset(0 50% 0 0)';
      }
      if (n > 0.35 && WC_HOMOGLYPH[this.chars[i]] && p(0.03 + 0.9 * n / N * 3)){    // ký tự bị thay bằng bản "sai"
        s.sub = WC_HOMOGLYPH[this.chars[i]]; heavy = true;
      }
      const hidden = now < s.hide;
      const css = 'transform:translate(' + s.dx.toFixed(1) + 'px,' + s.dy.toFixed(1) + 'px) scale(' + s.sx.toFixed(2) + ',' + s.sy.toFixed(2) + ');' +
        (s.op < 1 ? 'opacity:' + s.op.toFixed(2) + ';' : '') + (s.col ? 'color:' + s.col + ';' : '') +
        (s.clip ? 'clip-path:' + s.clip + ';' : '') + (hidden ? 'visibility:hidden;' : '');
      const sp = this.spans[i];
      if (css !== s.css){ s.css = css; sp.style.cssText = css; }
      const txt = s.sub || this.chars[i];
      if (sp.textContent !== txt) sp.textContent = txt;
    }
    return heavy;
  }

  restore(){
    this.el.classList.remove('wc-name');
    this.el.removeAttribute('data-t');
    this.el.style.removeProperty('--go'); this.el.style.removeProperty('--gx'); this.el.style.removeProperty('--sh');
    this.el.textContent = this.orig;
  }
}

/* -------------------------------------------------------------------------- */

class WeirdHud {
  constructor(){ this.S = {}; this.status = { until: 0, orig: '', txt: '' }; }

  _S(p){ return this.S[p] || (this.S[p] = { frames: 0, kind: '', txt: '', nameOrig: null, forceNext: false }); }

  force(p){ this._S(p).forceNext = true; }

  // gọi SAU engine.updateHUD() mỗi frame sim. victims = các Ball đang bị Anxiety; I = cường độ 0..1
  after(g, victims, I, audio){
    for (const v of victims){
      if ((v.state.anxStage | 0) < 1) { if (this.S[v.player] && this.S[v.player].frames > 0) this.clear(g, v.player); continue; }
      const p = v.player, S = this._S(p), pf = 'p' + p;
      const block = document.querySelector('.hp-' + pf), hpEl = document.getElementById(pf + 'HpText'), nameEl = document.getElementById(pf + 'NameLbl');
      if (S.frames <= 0 && (S.forceNext || Math.random() < (0.03 + 0.6 * Math.pow(I, 1.4)) / 60)){
        S.forceNext = false;
        const k = Math.random();
        S.kind = k < 0.40 ? 'digits' : k < 0.62 ? 'shift' : k < 0.80 ? 'dup' : 'name';
        S.frames = 2 + ((Math.random() * 4) | 0);
        S.dx = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 3); S.dy = (Math.random() - 0.5) * 3;
        if (audio && Math.random() < 0.5) audio.uiGlitch();
      }
      if (S.frames > 0){
        if (S.kind === 'digits' && hpEl){
          const t = hpEl.textContent, a = Array.from(t), idx = [];
          a.forEach((c, i) => { if (WC_DIGIT_GLITCH[c]) idx.push(i); });
          if (!S.txt || S.txt.length !== t.length){                                    // chọn 1 kiểu lỗi rồi giữ vài frame
            const arr = a.slice();
            if (idx.length){ const i = idx[(Math.random() * idx.length) | 0]; arr[i] = WC_DIGIT_GLITCH[arr[i]]; }
            if (Math.random() < 0.35 && arr.length > 3) arr.splice(1 + ((Math.random() * (arr.length - 2)) | 0), 1);  // rơi mất 1 ký tự
            S.txt = arr.join('');
          }
          hpEl.textContent = S.txt;
        } else if (S.kind === 'shift' && block){
          block.style.setProperty('--wcx', S.dx.toFixed(1) + 'px'); block.style.setProperty('--wcy', S.dy.toFixed(1) + 'px'); block.classList.add('wc-shift');
        } else if (S.kind === 'dup' && block){
          block.classList.add('wc-dup');
        } else if (S.kind === 'name' && nameEl && !nameEl.classList.contains('wc-name')){
          if (S.nameOrig === null) S.nameOrig = nameEl.textContent;
          const arr = Array.from(S.nameOrig), i = (Math.random() * arr.length) | 0;
          if (arr[i] !== ' ' && WC_HOMOGLYPH[arr[i]]) arr[i] = WC_HOMOGLYPH[arr[i]]; else arr.splice(i, 0, arr[i]);
          nameEl.textContent = arr.join('');
        }
        S.frames--;
        if (S.frames <= 0) this.clear(g, p, true);
      }
    }
    // dòng trạng thái ("ĐANG GIAO TRANH") thỉnh thoảng bị hỏng
    const bar = document.getElementById('statusBar');
    if (bar){
      const st = this.status;
      if (st.until && Date.now() > st.until){ if (bar.textContent === st.txt) bar.textContent = st.orig; st.until = 0; }
      if (!st.until && I > 0.45 && g.phase === 'sim' && Math.random() < (0.02 + 0.2 * I * I) / 60){
        st.orig = bar.textContent;
        const a = Array.from(st.orig), i = (Math.random() * a.length) | 0;
        st.txt = Math.random() < 0.3 ? '? ? ? ? ?' : (a.slice(0, i).join('') + '?' + a.slice(i + 1).join(''));
        bar.textContent = st.txt; st.until = Date.now() + 110 + Math.random() * 160;
      }
    }
  }

  clear(g, p, keepFlag){
    const S = this._S(p), pf = 'p' + p;
    const block = document.querySelector('.hp-' + pf), nameEl = document.getElementById(pf + 'NameLbl');
    if (block){ block.classList.remove('wc-shift', 'wc-dup'); }
    if (S.nameOrig !== null && nameEl && !nameEl.classList.contains('wc-name')){ nameEl.textContent = S.nameOrig; }
    S.nameOrig = null; S.txt = ''; S.frames = 0;
  }

  reset(g){
    [1, 2].forEach(p => this.clear(g, p));
    const bar = document.getElementById('statusBar');
    if (bar && this.status.until){ if (bar.textContent === this.status.txt) bar.textContent = this.status.orig; }
    this.status.until = 0;
    if (g && g.updateHUD && g.balls && g.balls.length === 2){ try { g.updateHUD(); } catch (e) {} }   // ghi lại số HP thật
  }
}

/* -------------------------------------------------------------------------- */

class WeirdDebug {
  constructor(dir){ this.dir = dir; this.el = null; this.open = false; this.readout = null; this.t = 0; }

  mount(){
    if (this.el) return;
    const el = document.createElement('div');
    el.id = 'wcDebug';
    el.innerHTML =
      '<button type="button" class="wc-tab" data-act="toggle">WC</button>' +
      '<div class="wc-body">' +
        '<div class="wc-row">' +
          '<button type="button" data-act="stage" data-v="0">1 Normal</button>' +
          '<button type="button" data-act="stage" data-v="1">2 Uneasy</button>' +
          '<button type="button" data-act="stage" data-v="2">3 Disturbed</button>' +
          '<button type="button" data-act="stage" data-v="3">4 Panic</button>' +
          '<button type="button" data-act="stage" data-v="4">5 Madness</button>' +
          '<button type="button" data-act="stage" data-v="5">6 Full</button>' +
        '</div>' +
        '<div class="wc-row">' +
          '<button type="button" data-act="auto">Auto</button>' +
          '<button type="button" data-act="speed">Time x1</button>' +
          '<button type="button" data-act="img">Ảnh</button>' +
          '<button type="button" data-act="ui">UI</button>' +
          '<button type="button" data-act="audio">Audio</button>' +
          '<button type="button" data-act="q">Q: auto</button>' +
        '</div>' +
        '<div class="wc-read"></div>' +
      '</div>';
    document.body.appendChild(el);
    this.el = el; this.readout = el.querySelector('.wc-read');
    // dùng pointerdown + stopPropagation để không bao giờ "lọt" xuống canvas game
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const b = e.target.closest('button'); if (!b) return;
      this.act(b.dataset.act, b.dataset.v);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.dir.active || !WEIRDCORE_DEBUG) return;
      const tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA') return;
      if (e.key >= '1' && e.key <= '6') this.dir.setDebugStage(+e.key - 1);
    });
  }

  act(a, v){
    const d = this.dir;
    if (a === 'toggle'){ this.open = !this.open; this.el.classList.toggle('open', this.open); }
    else if (a === 'stage') d.setDebugStage(+v);
    else if (a === 'auto') d.setDebugStage(null);
    else if (a === 'speed'){ d.dbg.timeScale = d.dbg.timeScale === 1 ? 4 : 1; }
    else if (a === 'img') d.debugFlash();
    else if (a === 'ui') d.debugUiGlitch();
    else if (a === 'audio'){ WEIRDCORE_CONFIG.audio = !WEIRDCORE_CONFIG.audio; if (WEIRDCORE_CONFIG.audio) d.audio.start(); else d.audio.stop(); }
    else if (a === 'q') d.quality.cycle();
    this.refresh(true);
  }

  show(v){
    if (!this.el) this.mount();
    this.el.style.display = v && WEIRDCORE_DEBUG ? 'block' : 'none';
  }

  refresh(force){
    if (!this.el || this.el.style.display === 'none') return;
    const t = performance.now();
    if (!force && t - this.t < 250) return;
    this.t = t;
    const d = this.dir, s = d.primary;
    const stacks = s ? s.state.wc.stacks : 0;
    const stage = s ? WEIRDCORE_STAGE_NAMES[d.anxiety.stageOf(stacks)] : '-';
    this.readout.textContent = stage + ' • ' + stacks + '/' + WEIRDCORE_CONFIG.maxStacks + ' • I ' + d.I.toFixed(2) +
      ' • ' + d.quality.label() + ' • ' + Math.round(d.quality.fps) + 'fps' + (d.dbg.stage != null ? ' • LOCK' : '');
    const btns = this.el.querySelectorAll('button');
    btns.forEach(b => {
      if (b.dataset.act === 'stage') b.classList.toggle('on', d.dbg.stage === +b.dataset.v);
      if (b.dataset.act === 'auto') b.classList.toggle('on', d.dbg.stage == null);
      if (b.dataset.act === 'speed'){ b.textContent = 'Time x' + d.dbg.timeScale; b.classList.toggle('on', d.dbg.timeScale > 1); }
      if (b.dataset.act === 'audio') b.classList.toggle('on', !!WEIRDCORE_CONFIG.audio);
      if (b.dataset.act === 'q') b.textContent = 'Q: ' + d.quality.label(true);
    });
  }
}
