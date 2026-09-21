# THE WEIRDCORE?! — hướng dẫn nhanh

## File mới
- `js/weirdcore/config.js`   – MỌI số cân bằng + công tắc (debug, quality, audio, images) + danh sách ảnh `WEIRDCORE_IMAGES`
- `js/weirdcore/anxiety.js`  – `AnxietySystem` (đếm tầng, debuff, kéo dài hồi chiêu) + `MadnessSystem` (lệch hướng, rung, afterimage)
- `js/weirdcore/screen.js`   – `ScreenDistortion` (overlay toàn màn hình + xé hình / lệch màu trên canvas game)
- `js/weirdcore/images.js`   – hệ thống ảnh + placeholder procedural
- `js/weirdcore/audio.js`    – âm thanh WebAudio procedural
- `js/weirdcore/hud.js`      – `WeirdcoreEffect` (chữ tên hỏng dần), glitch HUD đối thủ, bảng debug
- `js/weirdcore/director.js` – định nghĩa Ball + điều phối + tự chỉnh chất lượng
- `css/weirdcore.css`, `assets/weirdcore/*`

## Sửa file cũ (chỉ thêm hook, không đổi hành vi Ball khác)
`engine.js` (~12 dòng hook), `ball-class.js` (2 dòng), `ui.js` (3 dòng), `index.html` (CSS + 7 script + đổi "32" → "38 loại bóng").

## Debug (mở bằng mã bí mật)
- Nhập mã **ANXIETY** vào ô 🔑 (ở menu; trên PC nhập được cả khi đang chơi) → bảng debug được mở. Nhập lại để tắt.
  Trên điện thoại ô 🔑 bị ẩn khi đang trong trận, nên hãy nhập mã ở menu TRƯỚC khi vào trận.
- Ép mở bằng code: `WEIRDCORE_CONFIG.debug` trong config.js hoặc URL `?wcdebug=1` (mặc định false).
- Trong trận có The Weirdcore: nút **WC** bên phải màn hình (mobile) hoặc phím **1–6** (PC):
  1 Normal · 2 Uneasy · 3 Disturbed · 4 Panic · 5 Madness · 6 Full · Auto (thả khóa) · Time x4 · Ảnh · UI · Audio · Q (đổi chất lượng)
- URL tiện test: `?wcq=low|medium|high`  `?wcmute=1`  `?wcimg=0`

## Thêm ảnh của bạn
Thả file vào `assets/weirdcore/`, rồi trong `config.js` → `WEIRDCORE_IMAGES` đổi `enabled:true` ở dòng tương ứng
(hoặc thêm dòng mới). Chưa có ảnh → tự dùng placeholder procedural.
[NEED ASSET] weird_face_01.png · eye.png · liminal_room.png · weird_figure_01.png · static.png · distortion.png

## Gỡ hoàn toàn
Xoá 7 thẻ `<script src="js/weirdcore/...">` + thẻ CSS trong index.html, và các dòng có chữ `Weirdcore` trong engine.js / ui.js / ball-class.js.
