/* ============================================================================
   THE WEIRDCORE?!  -  config.js
   ----------------------------------------------------------------------------
   Mọi con số cân bằng / bật-tắt của Ball này nằm ở ĐÂY. Muốn chỉnh độ khó,
   tốc độ "xâm nhập", hay tắt hẳn 1 hiệu ứng thì chỉ cần sửa file này.

   Thứ tự nạp (xem index.html):
     config -> anxiety -> images -> screen -> audio -> hud -> director
   ========================================================================== */

const WEIRDCORE_CONFIG = {
  // ---- công tắc chung ------------------------------------------------------
  debug: false,       // true = hiện bảng debug (phím 1-6 / nút WC) khi có The Weirdcore trong trận.
                      // Mặc định TẮT: người chơi mở bằng MÃ BÍ MẬT  ANXIETY  (ô 🔑 ở menu; nhập lại để tắt).
                      // Dev có thể ép bằng URL:  ?wcdebug=1
  quality: 'auto',    // 'auto' | 'LOW' | 'MEDIUM' | 'HIGH'   (auto = tự giảm khi FPS tụt). URL: ?wcq=low
  audio: true,        // âm thanh procedural (WebAudio). URL: ?wcmute=1 để tắt
  images: true,       // hình weirdcore chớp nhanh (xem images.js). false = không bao giờ hiện hình
  assetDir: 'assets/weirdcore/',

  // ---- Anxiety: nhịp + số tầng ----------------------------------------------
  stackInterval: 2,   // cứ 2 giây (thời gian GAME, tự đứng khi Clock Ball ngưng thời gian) +1 tầng
  maxStacks: 26,      // 26 tầng = ~52 giây thì đạt đỉnh
  // số tầng cần để vào: [NORMAL, UNEASY, DISTURBED, PANIC, MADNESS]
  // Trận thường kéo dài ~35-70s nên mốc đã được nén lại so với timeline mẫu:
  //   6s Uneasy  |  14s Disturbed  |  24s Panic  |  36s Madness  |  52s đỉnh
  stageAt: [0, 3, 7, 12, 18],

  // ĐỐT MÁU: từ stage MADNESS (lv5 trong bảng debug, tức stageAt[4]) trở lên, đối thủ mất
  // `hp` máu mỗi `every` giây (thời gian game; đứng yên khi Clock Ball ngưng thời gian).
  // Bị chặn nếu The Weirdcore bị Powerless (vì cùng chạy trong def.update). Có thể giết đối thủ.
  burn: { fromStage: 4, hp: 1, every: 0.3 },

  // Mốc cân bằng cho Ball ĐỐI THỦ. Giá trị được NỘI SUY MƯỢT giữa các mốc theo số tầng
  // (không bị "nấc" khi đổi stage).
  //   speed : nhân với tốc độ khoá của đối thủ
  //   dmg   : nhân với MỌI sát thương đối thủ gây ra cho The Weirdcore
  //   cd    : hệ số kéo dài hồi chiêu / nhịp kỹ năng (2.0 = hồi chiêu chậm gấp đôi)
  //   shake : độ rung hình ảnh của đối thủ (đơn vị thế giới ~ px), chỉ là hiệu ứng vẽ
  anchors: [
    { s: 0,  speed: 1.00, dmg: 1.00, cd: 1.00, shake: 0   },
    { s: 3,  speed: 0.97, dmg: 0.96, cd: 1.08, shake: 0.5 },   // UNEASY
    { s: 7,  speed: 0.91, dmg: 0.90, cd: 1.25, shake: 1   },   // DISTURBED
    { s: 12, speed: 0.80, dmg: 0.78, cd: 1.60, shake: 2   },   // PANIC
    { s: 18, speed: 0.68, dmg: 0.65, cd: 2.00, shake: 3.5 },   // MADNESS
    { s: 26, speed: 0.60, dmg: 0.55, cd: 2.40, shake: 5   },   // đỉnh (sàn: không bao giờ thấp hơn)
  ],
};

// dùng tên này cho gọn khi test:  WEIRDCORE_DEBUG = true/false
let WEIRDCORE_DEBUG = WEIRDCORE_CONFIG.debug;

const WEIRDCORE_STAGE_NAMES = ['NORMAL', 'UNEASY', 'DISTURBED', 'PANIC', 'MADNESS'];

// ---- URL override (tiện test trên điện thoại, không cần sửa code) ------------
(function readWeirdcoreParams(){
  try{
    const q = new URLSearchParams(location.search);
    if (q.has('wcdebug')) { WEIRDCORE_CONFIG.debug = q.get('wcdebug') !== '0'; WEIRDCORE_DEBUG = WEIRDCORE_CONFIG.debug; }
    if (q.has('wcq'))     { WEIRDCORE_CONFIG.quality = String(q.get('wcq')).toUpperCase(); }
    if (q.get('wcmute') === '1') WEIRDCORE_CONFIG.audio = false;
    if (q.get('wcimg') === '0')  WEIRDCORE_CONFIG.images = false;
  }catch(e){ /* file:// hoặc trình duyệt cũ -> dùng mặc định */ }
})();

/* ---------------------------- QUALITY PRESETS -------------------------------
   Effect Weirdcore tự đổi giữa 3 mức này khi qualityLevel='auto'.
   ovScale : độ phân giải overlay toàn màn hình so với kích thước CSS
             (thấp = nhẹ hơn VÀ đúng chất "low-res analog")
   ovEvery : vẽ lại overlay mỗi N khung hình
   eyes    : số mắt tối đa ở rìa màn hình
   strips  : số dải "xé hình" tối đa trên canvas game
   chroma  : bật lệch màu kênh RGB (chỉ nháy ngắn) trên canvas game
   imgRate : nhân tần suất hình weirdcore chớp
   audio   : nhân độ đầy đủ của âm thanh (LOW bỏ bớt lớp)                          */
const WEIRDCORE_QUALITY = {
  LOW:    { ovScale: 0.28, ovEvery: 2, eyes: 2, strips: 1, chroma: false, imgRate: 0.6, noiseTiles: 1 },
  MEDIUM: { ovScale: 0.38, ovEvery: 1, eyes: 4, strips: 2, chroma: false, imgRate: 0.85, noiseTiles: 2 },
  HIGH:   { ovScale: 0.50, ovEvery: 1, eyes: 6, strips: 3, chroma: true,  imgRate: 1.0, noiseTiles: 3 },
};
const WEIRDCORE_QUALITY_ORDER = ['LOW', 'MEDIUM', 'HIGH'];

/* ---------------------------- IMAGE MANIFEST --------------------------------
   Nơi để BẠN thêm ảnh weirdcore. Thả file vào  assets/weirdcore/  rồi:
     - đổi  enabled:true  ở dòng tương ứng, hoặc thêm 1 dòng mới.
   Nếu ảnh chưa có / tải lỗi -> tự dùng ảnh procedural cùng `kind` (xem images.js).
   Các trường:
     kind   : bliss | eyes | qmarks | face | eye | corridor | figure | static | distort
     blend  : 'source-over' (che thường, mặc định) | 'lighter' (chỉ phần SÁNG cộng vào - kín đáo hơn, hợp ảnh nền đen)
     alpha  : [min,max] độ mờ khi chớp (giữ THẤP - người chơi không được chắc mình vừa thấy gì)
     minI   : cường độ Weirdcore tối thiểu (0..1) mới được phép xuất hiện
     weight : độ hay xuất hiện
   [NEED ASSET] = file bạn có thể tự làm và bỏ vào.                                      */
const WEIRDCORE_IMAGES = [
  // 3 ảnh tham chiếu bạn gửi (đã nén nhẹ cho mobile) - ĐANG BẬT
  { id:'bliss',  kind:'bliss',  src:'bliss_eyes_01.jpg',     enabled:true,  blend:'source-over', alpha:[0.10,0.24], minI:0.30, weight:3 },
  { id:'eyes',   kind:'eyes',   src:'eyes_wall_01.jpg',      enabled:true,  blend:'source-over', alpha:[0.14,0.32], minI:0.18, weight:3 },
  { id:'qmarks', kind:'qmarks', src:'qmarks_static_01.jpg',  enabled:true,  blend:'source-over', alpha:[0.14,0.34], minI:0.22, weight:3 },
  // ảnh procedural có sẵn (thay bằng ảnh thật của bạn khi có)
  { id:'face',   kind:'face',   src:'weird_face_01.png',     enabled:false, blend:'source-over', alpha:[0.10,0.22], minI:0.45, weight:2 }, // [NEED ASSET: weird_face_01.png - khuôn mặt méo, mắt cách xa nhau]
  { id:'eye',    kind:'eye',    src:'eye.png',               enabled:false, blend:'source-over', alpha:[0.16,0.34], minI:0.12, weight:2 }, // [NEED ASSET: eye.png - 1 con mắt rất xa / rất nhỏ]
  { id:'liminal',kind:'corridor',src:'liminal_room.png',     enabled:false, blend:'source-over', alpha:[0.10,0.22], minI:0.25, weight:2 }, // [NEED ASSET: liminal_room.png - hành lang / căn phòng trống]
  { id:'figure', kind:'figure', src:'weird_figure_01.png',   enabled:false, blend:'source-over', alpha:[0.12,0.26], minI:0.50, weight:2 }, // [NEED ASSET: weird_figure_01.png - bóng người 1 mắt (như ảnh 1)]
  { id:'static', kind:'static', src:'static.png',            enabled:false, blend:'lighter',     alpha:[0.10,0.28], minI:0.40, weight:1 }, // [NEED ASSET: static.png - nhiễu texture]
  { id:'distort',kind:'distort',src:'distortion.png',        enabled:false, blend:'source-over', alpha:[0.10,0.24], minI:0.55, weight:1 }, // [NEED ASSET: distortion.png - chữ / vật quen thuộc bị méo]
];
// Hình dùng làm "nền chữ ???" trôi chậm ở rìa tối khi Weirdcore lên cao (dùng kind 'qmarks')
const WEIRDCORE_SWARM_KIND = 'qmarks';
