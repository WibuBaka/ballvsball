/* ============================================================================
   THE WEIRDCORE?!  -  anxiety.js
   ----------------------------------------------------------------------------
   AnxietySystem : đếm tầng, nội suy debuff, kéo dài hồi chiêu (GAMEPLAY)
   MadnessSystem : làm lệch hướng di chuyển + rung hình ảnh của nạn nhân

   Nguyên tắc an toàn (ưu tiên số 2 - không phá game):
     * Không bao giờ dịch chuyển vị trí, không đụng collision. Chỉ XOAY vector vận tốc;
       enforceSpeedLock() của engine giữ nguyên độ lớn tốc độ.
     * Rung / afterimage / méo CHỈ là hiệu ứng vẽ (ctx transform), vị trí vật lý không đổi.
     * Sàn debuff: tốc độ >= 60%, sát thương >= 55% => luôn chơi được.
     * Không sửa code của Ball khác: mọi thứ đi qua state.anx* của nạn nhân.
   ========================================================================== */

class AnxietySystem {
  constructor(cfg){ this.cfg = cfg; }

  stageOf(stacks){
    const a = this.cfg.stageAt; let s = 0;
    for (let i = 1; i < a.length; i++) if (stacks >= a[i]) s = i;
    return s;
  }

  // 0..1 - cường độ tổng thể (dùng cho hiệu ứng màn hình / tên / âm thanh)
  intensity(stacks){ return clamp(stacks / this.cfg.maxStacks, 0, 1); }

  // nội suy tuyến tính giữa các mốc trong cfg.anchors theo số tầng (có thể lẻ)
  profile(stacks){
    const an = this.cfg.anchors;
    stacks = clamp(stacks, 0, this.cfg.maxStacks);
    let i = 0;
    while (i < an.length - 2 && stacks > an[i + 1].s) i++;
    const A = an[i], B = an[i + 1];
    const t = clamp((stacks - A.s) / ((B.s - A.s) || 1), 0, 1);
    const L = (k) => A[k] + (B[k] - A[k]) * t;
    return { stage: this.stageOf(stacks), speed: L('speed'), dmg: L('dmg'), cd: L('cd'), shake: L('shake') };
  }

  // Ghi debuff lên NẠN NHÂN. Các field này được engine/Ball đọc:
  //   anxSpeedMult -> Ball.currentMods (nhân vào tốc độ khoá)
  //   anxDmgMult   -> GameEngine._postStep (giảm mọi sát thương nạn nhân gây ra)
  //   anxCdMult    -> GameEngine._updateWorld (chậm nhịp kỹ năng) + dragCooldowns()
  //   anxStage / anxShake -> MadnessSystem + render
  apply(victim, stacksSmooth, stacksInt){
    const p = this.profile(stacksSmooth);
    const s = victim.state;
    s.weirdAnxiety = stacksInt;
    s.anxStage = p.stage;
    s.anxSpeedMult = p.speed;
    s.anxDmgMult = p.dmg;
    s.anxCdMult = p.cd;
    s.anxShake = p.shake;
  }

  clear(victim){
    const s = victim.state;
    s.weirdAnxiety = 0; s.anxStage = 0; s.anxSpeedMult = 1; s.anxDmgMult = 1; s.anxCdMult = 1; s.anxShake = 0;
  }

  // Các kỹ năng lưu mốc thời gian ("lần dùng gần nhất" hoặc "sẵn sàng lúc") dạng g.t-based
  // (vd bombCD, hookCD, lastFire...). Mỗi frame ta đẩy mốc đó tiến lên dt*(1-1/cd) nên
  // (g.t - mốc) chỉ lớn lên với tốc độ 1/cd => hồi chiêu dài ra đúng hệ số cd.
  // Timer kiểu cộng dt (bladeTimer, torTimer...) đã được chậm lại bằng cách truyền dt/cd
  // vào def.update (xem engine._updateWorld).
  // KHÔNG đụng: portalCD (ICD của portal map), shieldCooldown (là độ dài, không phải mốc), *Until (thời lượng hiệu ứng).
  static get CD_KEY(){ return /^(?!portal)[A-Za-z]*CD$|^(lastFire|lastVamp|lastShock|shieldBrokenAt|homingAt)$/; }
  dragCooldowns(ball, dt, g){
    const cd = ball.state.anxCdMult;
    if (!(cd > 1.001)) return;
    const shift = dt * (1 - 1 / cd);
    const st = ball.state, re = AnxietySystem.CD_KEY;
    for (const k in st){
      if (!re.test(k)) continue;
      const v = st[k];
      if (typeof v === 'number' && v > 0 && v <= g.t + 0.001) st[k] = v + shift;
    }
  }
}

/* -------------------------------------------------------------------------- */

class MadnessSystem {
  constructor(cfg){ this.cfg = cfg; }

  // Ball đang được kỹ năng khác tự điều khiển vị trí/vận tốc -> đừng can thiệp (giống cách
  // engine bỏ qua 'disoriented' khi ccImmune)
  eligible(ball){
    const s = ball.state;
    if (s.ccImmune || s.tornadoCaptured) return false;
    if (s.torPhase === 'spin') return false;
    if (s.floPhase === 'toCenter' || s.floPhase === 'picking') return false;
    return true;
  }

  _M(ball){
    return ball.state.mad || (ball.state.mad = { next: 0, queue: [], turnLeft: 0, turnRate: 0, freezeUntil: 0, armed: false });
  }

  _rotate(ball, ang){
    const c = Math.cos(ang), s = Math.sin(ang), vx = ball.vx, vy = ball.vy;
    ball.vx = vx * c - vy * s;
    ball.vy = vx * s + vy * c;
  }

  // xoay hướng đi "trong `over` giây" (over=0 => giật tức thời)
  _turn(ball, rad, over){
    const M = this._M(ball);
    if (over <= 0.001){ this._rotate(ball, rad); return; }
    M.turnLeft += rad;
    M.turnRate = Math.max(M.turnRate, Math.abs(rad) / over);
  }

  _schedule(M, g, stage){
    const gap = stage <= 2 ? rand(1.4, 2.6) : stage === 3 ? rand(0.9, 1.8) : rand(0.45, 1.15);
    M.next = g.t + gap;
  }

  _fire(ball, g, stage){
    const M = this._M(ball), D = Math.PI / 180, sgn = Math.random() < 0.5 ? -1 : 1, r = Math.random();
    if (stage === 2){                                   // DISTURBED: trôi hướng nhẹ
      this._turn(ball, sgn * rand(4, 10) * D, 0.35);
    } else if (stage === 3){                            // PANIC: né lệch + hiếm khi quặt gắt
      if (r < 0.72)      this._turn(ball, sgn * rand(15, 35) * D, 0.18);
      else if (r < 0.90) this._turn(ball, sgn * rand(60, 100) * D, 0.10);
      else               M.freezeUntil = g.t + 0.05;
    } else {                                            // MADNESS: đảo hướng bất ngờ nhưng vẫn "có nhịp"
      if (r < 0.30)      this._turn(ball, (Math.random() < 0.5 ? 1 : -1) * rand(150, 180) * D, 0.06);   // đi trái -> đột ngột phải
      else if (r < 0.55) this._turn(ball, sgn * rand(60, 120) * D, 0.08);
      else if (r < 0.75){ this._turn(ball, sgn * rand(20, 40) * D, 0); M.freezeUntil = g.t + 0.05; }   // giật + khựng
      else if (r < 0.90){                                                                              // rung nhẹ tại chỗ
        const a = rand(70, 130) * D;
        for (let i = 0; i < 3; i++) M.queue.push({ at: g.t + 0.07 * (i + 1), rad: (i % 2 ? -1 : 1) * sgn * a });
      } else M.freezeUntil = g.t + rand(0.08, 0.14);                                                   // delay vài frame
    }
  }

  // gọi mỗi frame từ engine (sau def.update, trước khi tích phân vị trí)
  steer(ball, dt, g){
    const stage = ball.state.anxStage | 0;
    if (stage < 2) return;
    const M = this._M(ball);
    if (!M.armed){ M.armed = true; this._schedule(M, g, stage); }

    // hàng đợi giật (wiggle)
    while (M.queue.length && M.queue[0].at <= g.t){ this._turn(ball, M.queue.shift().rad, 0.03); }

    // xoay dần phần còn lại của một cú quặt
    if (Math.abs(M.turnLeft) > 1e-4){
      const step = Math.min(Math.abs(M.turnLeft), M.turnRate * dt) * Math.sign(M.turnLeft);
      this._rotate(ball, step);
      M.turnLeft -= step;
      if (Math.abs(M.turnLeft) <= 1e-4){ M.turnLeft = 0; M.turnRate = 0; }
    }

    // jitter hướng rất nhỏ mỗi frame (không cộng dồn thành lệch lớn)
    if (stage >= 3) this._rotate(ball, (Math.random() * 2 - 1) * (stage === 3 ? 0.010 : 0.028));

    if (g.t >= M.next && !M.queue.length && M.turnLeft === 0){
      this._fire(ball, g, stage);
      this._schedule(M, g, stage);
    }
  }

  // true = frame này ball "khựng" (vị trí không tích phân) - chỉ vài frame, vận tốc giữ nguyên
  frozen(ball, g){
    const M = ball.state.mad;
    return !!M && g.t < M.freezeUntil;
  }

  // ---- phần VẼ: độ rung / afterimage của nạn nhân (không ảnh hưởng vật lý) -------
  visual(ball, g){
    const s = ball.state, amp = s.anxShake || 0;
    if (amp <= 0.01) return null;
    const V = s.madV || (s.madV = { t: -1, dx: 0, dy: 0, rot: 0, sc: 1, after: 0, ax: 0, ay: 0, nextAfter: 0 });
    const T = g.fxT;
    if (T - V.t > 0.035){                                // ~28Hz: rung kiểu "khung hình hỏng", không mượt
      V.t = T;
      V.dx = (Math.random() * 2 - 1) * amp;
      V.dy = (Math.random() * 2 - 1) * amp;
      V.rot = (Math.random() * 2 - 1) * amp * 0.010;
      V.sc = 1 + (Math.random() * 2 - 1) * amp * 0.005;
      const stage = s.anxStage | 0;
      if (stage >= 3 && T >= V.nextAfter){                // afterimage cực ngắn
        V.after = T + rand(0.06, 0.12);
        const a = rand(0, Math.PI * 2), d = rand(5, 11) * (stage === 4 ? 1.2 : 0.8);
        V.ax = Math.cos(a) * d; V.ay = Math.sin(a) * d;
        V.nextAfter = T + (stage === 4 ? rand(0.5, 1.4) : rand(1.6, 3.5));
      }
    }
    return V;
  }
}
