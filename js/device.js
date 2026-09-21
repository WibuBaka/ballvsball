/* ============================================================================
   device.js  -  tự động nhận dạng thiết bị & thích ứng giao diện
   ----------------------------------------------------------------------------
   File này được nạp ĐẦU TIÊN (trong <head>), trước mọi script khác.

   Nó làm 4 việc:
   1. Nhận dạng thiết bị: phone / tablet / desktop, cảm ứng hay chuột, iOS /
      Android, đang chạy trong app đã "Thêm vào MH chính" (standalone) hay không.
   2. Gắn các class lên <html> để CSS tự đổi giao diện, ví dụ:
        is-phone | is-tablet | is-desktop
        touch-primary   (thiết bị chính dùng cảm ứng)   has-touch
        is-ios | is-android | is-standalone
        orient-portrait | orient-landscape
        can-fullscreen  (trình duyệt hỗ trợ toàn màn hình)
   3. Cập nhật biến CSS --app-h / --app-w = kích thước thật của vùng hiển thị
      (sửa lỗi 100vh trên iOS/Android khi thanh địa chỉ co giãn) và phát sự kiện
      `layoutchange` mỗi khi xoay màn hình / đổi kích thước để game vẽ lại.
   4. Chặn zoom bằng 2 ngón, đưa nút toàn màn hình vào menu (nếu hỗ trợ).

   Dùng trong code khác:  window.DEVICE.type, DEVICE.touchPrimary, ...
   ========================================================================== */
(function(){
  'use strict';
  const root = document.documentElement;
  const mq = (q)=> (window.matchMedia ? window.matchMedia(q).matches : false);

  const ua = navigator.userAgent || '';
  const uaData = navigator.userAgentData || null;
  const maxTouch = navigator.maxTouchPoints || 0;

  // iPadOS 13+ giả danh Mac trong userAgent -> nhận ra bằng số điểm chạm
  const isIPadOS = /Macintosh/.test(ua) && maxTouch > 1;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || isIPadOS;
  const isAndroid = /Android/i.test(ua);
  const uaMobile = (uaData && typeof uaData.mobile === 'boolean')
    ? uaData.mobile
    : (isIOS || isAndroid || /Mobi|IEMobile|Opera Mini/i.test(ua));

  const hasTouch = maxTouch > 0 || ('ontouchstart' in window);
  // "Cảm ứng là chính": điện thoại/tablet. Laptop có màn cảm ứng nhưng vẫn có
  // chuột (pointer:fine) sẽ KHÔNG bị tính là touch-primary.
  // ('hover: none' alone isn't enough: a PC with no mouse detected reports it too,
  //  so it only counts together with real touch / mobile evidence)
  const touchPrimary = mq('(pointer: coarse)') ||
                       (mq('(hover: none)') && (hasTouch || uaMobile)) ||
                       ((isIOS || isAndroid) && hasTouch);

  const shortSide = Math.min(window.screen.width || innerWidth, window.screen.height || innerHeight);
  let type = 'desktop';
  if (touchPrimary || uaMobile) type = shortSide < 600 ? 'phone' : 'tablet';

  const isStandalone = (navigator.standalone === true) || mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)');
  const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  const DEVICE = {
    type, isPhone: type === 'phone', isTablet: type === 'tablet', isDesktop: type === 'desktop',
    touchPrimary, hasTouch, isIOS, isAndroid, isStandalone, canFullscreen,
    width: innerWidth, height: innerHeight, orientation: 'portrait',
    toggleFullscreen, isFullscreen,
  };
  window.DEVICE = DEVICE;

  function setClass(name, on){ root.classList.toggle(name, !!on); }

  // ---- các class không đổi trong suốt phiên ----
  setClass('is-phone', DEVICE.isPhone);
  setClass('is-tablet', DEVICE.isTablet);
  setClass('is-desktop', DEVICE.isDesktop);
  setClass('touch-primary', touchPrimary);
  setClass('has-touch', hasTouch);
  setClass('is-ios', isIOS);
  setClass('is-android', isAndroid);
  setClass('is-standalone', isStandalone);
  setClass('can-fullscreen', canFullscreen);

  // ---- phần thay đổi khi xoay / đổi kích thước ----
  function apply(){
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width  : innerWidth);
    const h = Math.round(vv ? vv.height : innerHeight);
    DEVICE.width = w; DEVICE.height = h;
    DEVICE.orientation = h >= w ? 'portrait' : 'landscape';
    root.style.setProperty('--app-w', w + 'px');
    root.style.setProperty('--app-h', h + 'px');
    setClass('orient-portrait', DEVICE.orientation === 'portrait');
    setClass('orient-landscape', DEVICE.orientation === 'landscape');
    window.dispatchEvent(new Event('layoutchange'));
  }
  let queued = false;
  function schedule(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(()=>{ queued = false; apply(); });
  }
  window.addEventListener('resize', schedule);
  // iOS báo kích thước cũ ngay lúc xoay -> đo lại thêm một lần sau khi xoay xong
  window.addEventListener('orientationchange', ()=>{ schedule(); setTimeout(schedule, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
  apply();

  // ---- chặn zoom bằng 2 ngón (iOS Safari bỏ qua user-scalable=no) ----
  if (touchPrimary) {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(t =>
      document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  }

  // ---- toàn màn hình ----
  function isFullscreen(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFullscreen(){
    try {
      if (isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        const el = root;
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
    } catch (e) { /* trình duyệt từ chối -> bỏ qua */ }
  }
  function syncFsButton(){
    const b = document.getElementById('btnFullscreen');
    if (b) b.textContent = isFullscreen() ? '⤡ THOÁT TOÀN MÀN HÌNH' : '⛶ TOÀN MÀN HÌNH';
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    const b = document.getElementById('btnFullscreen');
    if (b) b.addEventListener('click', toggleFullscreen);
    syncFsButton();
  });
  document.addEventListener('fullscreenchange', ()=>{ syncFsButton(); schedule(); });
  document.addEventListener('webkitfullscreenchange', ()=>{ syncFsButton(); schedule(); });
})();
