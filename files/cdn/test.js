// SGame CDN Test Dosyası
console.log("SGame CDN başarıyla çalışıyor! 🚀");

window.addEventListener('DOMContentLoaded', () => {
  const msg = document.createElement('div');
  msg.textContent = "SGame CDN testi başarılı! Bu mesajı görüyorsan, CDN çalışıyor demektir.";
  msg.style.cssText = "position:fixed;bottom:20px;right:20px;background:#2ecc71;color:#fff;padding:15px 20px;border-radius:8px;font-family:sans-serif;font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,0.3);";
  document.body.appendChild(msg);
});