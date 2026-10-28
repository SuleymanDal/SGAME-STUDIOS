SGNET v3.2.0 — Resmî Dokümantasyon
Gerçek zamanlı, eşten eşe (P2P) senkronizasyon, olay yayını ve düşük gecikmeli veri iletişim kütüphanesi.
WebRTC (trystero-mqtt üzerinden) tabanlıdır; tarayıcıda ve Node.js ortamında çalışır.

İçindekiler
Genel Bakış

Kurulum

Hızlı Başlangıç

Temel Kavramlar

API Referansı

Bağlantı Yönetimi

Veri Gönderme (out)

Olay (Event) Sistemi

Senkronizasyon

Büyük Veri Gönderimi

Ses Akışı

Ağ Kalitesi ve Ölçümler

Yapılandırma

Gelişmiş Özellikler

Olaylar (Listener'lar)

İstatistikler

Örnekler

Sürüm Notları

1. Genel Bakış
SGNET, tarayıcı tabanlı çok oyunculu uygulamalar, işbirlikçi araçlar ve gerçek zamanlı veri paylaşımı için tasarlanmış hafif bir P2P iletişim katmanıdır.

Öne Çıkan Özellikler
Özellik	Açıklama
🔗 P2P Bağlantı	Merkezi sunucu yok; WebRTC + MQTT sinyalleşmesi
📦 İkili Protokol	Özel ikili (binary) kodlama ile minimum bant genişliği
🚀 Öncelikli Kuyruk	Yüksek / orta / düşük öncelikli mesaj yönetimi
🔁 Güvenilir Mesajlar	ACK + otomatik yeniden deneme
🗜️ Sıkıştırma	RLE (Huffman deneysel)
🎯 Delta Snapshot	Yalnızca değişen alanlar gönderilir
🎮 Tahmin (Prediction)	İstemci taraflı tick tabanlı tahmin
🎧 Ses Akışı	Float32 tabanlı ses kanalı
🧠 Binary Event	Kayıtlı olay kimlikleri ile isim yerine tek byte
⏱️ Rate Limit	Peer başına saniyede mesaj sınırı
📊 Bağlantı Kalitesi	Ping/RTT bazlı otomatik değerlendirme
🔄 Oturum (Session)	Yeniden bağlanma için oturum kimliği
2. Kurulum
SGNET, trystero kütüphanesinin MQTT modülüne ihtiyaç duyar.

Tarayıcıda (Script Etiketi)
html
<!-- Trystero MQTT (CDN) -->
<script src="https://cdn.jsdelivr.net/npm/trystero@latest/dist/trystero-mqtt.min.js"></script>
<!-- SGNET -->
<script src="sgnet.js"></script>
Modül Olarak
html
<script type="module">
  import "https://cdn.jsdelivr.net/npm/trystero@latest/dist/trystero-mqtt.min.js";
  import "./sgnet.js";
  // global.sgNet artık hazır
</script>
⚠️ Not: SGNET bir IIFE'dir; global scope'a sgNet nesnesi olarak eklenir.

3. Hızlı Başlangıç
Oda Oluşturma (Host)
js
// Oda oluştur
const result = await sgNet.create("benim-odam", "gizli-sifre");
console.log("Bağlandım:", result.alias);

// Bağlantı olayını dinle
sgNet.on("connected", ({ alias, id }) => {
  console.log(`${alias} odaya katıldı`);
});

// Veri gönder
sgNet.out({ merhaba: "dünya" }, "Q");
Odaya Katılma
js
const result = await sgNet.join("benim-odam", "gizli-sifre", "oyuncu1");
console.log("Katıldım:", result.alias);

// Veri dinle
sgNet.on("data", (payload) => {
  console.log("Gelen veri:", payload);
});
4. Temel Kavramlar
4.1. Alias
Her istemcinin oda içinde görünen kimliğidir. create çağrısında otomatik atanır, join çağrısında elle verilebilir.

4.2. Target (Q ve alias listesi)
"Q" → tüm peer'lere yayın (broadcast)

"oyuncu1,oyuncu2" → belirtilen alias'lara gönderim

Belirtilmezse → broadcast

4.3. Priority (Öncelik)
Mesajlar üç öncelik seviyesine sahiptir: "high", "med" (varsayılan), "low". Kuyruk aktifken yüksek öncelikliler önce gönderilir.

4.4. Reliable (Güvenilir Mesaj)
reliable işaretli mesajlar ACK bekler ve maxRetries kadar yeniden denenir.

4.5. Binary Event
Olay isimleri bir kez kaydedilip tek byte'lık ID ile gönderilebilir. Bu, her mesajda isim string'i taşımaktan %80+'a kadar tasarruf sağlar.

5. API Referansı
5.1. Bağlantı Yönetimi
sgNet.create(server, pass): Promise<{server, alias}>
Oda oluşturur (host). Aynı server + pass kombinasyonu aynı odaya işaret eder.

js
await sgNet.create("oyun-odasi", "gizli123");
sgNet.join(server, pass, alias?): Promise<{server, alias}>
Var olan odaya katılır. alias verilmezse p_xxxx formatında rastgele atanır.

js
await sgNet.join("oyun-odasi", "gizli123", "ahmet");
sgNet.leave(): Promise<void>
Odadan ayrılır, tüm zamanlayıcıları ve kaynakları temizler.

sgNet.getAlias(): string
Kendi alias'ını döndürür.

sgNet.getServer(): string
Bağlı olduğun oda adını döndürür.

sgNet.peers(): string[]
Odadaki diğer katılımcıların alias listesini döndürür.

5.2. Veri Gönderme (out)
sgNet.out(payload, target?) zincirlenebilir bir OutBuilder döndürür. Zincirin sonuna kadar gelen çağrılar then/await ile tetiklenir.

js
// Basit gönderim
await sgNet.out({ x: 1, y: 2 }, "Q");

// Yüksek öncelikli ve güvenilir
await sgNet.out({ kritik: true }, "oyuncu1").high.reliable;

// Düşük öncelik
sgNet.out({ tick: 42 }, "Q").low;
Zincirleme Özellikleri
Özellik	Etkisi
.high	Yüksek öncelik
.med	Orta öncelik (varsayılan)
.low	Düşük öncelik
.reliable	ACK'li, tekrar denemeli gönderim
.onFail(cb)	Hata callback'i
Hata Dinleme
js
sgNet.out(buyukVeri, "Q").reliable.onFail((reason) => {
  console.warn("Gönderilemedi:", reason); // "timeout" | "bandwidth"
});
5.3. Olay (Event) Sistemi
sgNet.registerEvent(name, id?): number
Bir olayı ikili protokole kaydeder. Kayıt sonrası emit yerine isim yerine ID gönderilir.

js
sgNet.registerEvent("playerMove");
sgNet.registerEvent("chat", 0x90);
sgNet.on(name, cb): sgNet
Yerleşik veya özel bir olayı dinler.

js
sgNet.on("data", (payload) => { /* ... */ });
sgNet.on("playerMove", (payload) => { /* ... */ });
sgNet.off(name, cb?): sgNet
Dinleyiciyi kaldırır. cb verilmezse tüm dinleyiciler silinir.

Yerleşik Olay İsimleri
İsim	Açıklama
data	Ham out ile gelen veri
reliable	Güvenilir gönderimden gelen veri
connected	Yeni peer katıldı {alias, id}
left	Peer ayrıldı {alias}
timeout	Peer zaman aşımına uğradı {peerId}
sync	Snapshot alındı {from, added, updated}
typing	Yazıyor göstergesi {from, on}
audio	Ses örneği {samples, peerId}
audioStarted / audioStopped	Ses kaydı durum değişikliği
dropped	Mesaj düştü {msgId}
disconnect	Bağlantı koptu {reason}
5.4. Senkronizasyon
sgNet.sync(target?): Promise<number>
Global ent (entity) listesini peer'lere gönderir. Delta snapshot kullanır: yalnızca değişen alanlar gider.

js
await sgNet.sync("Q");
💡 Gereksinim: window.ent global nesnesi list özelliğiyle var olmalı ve her entity {id, type, data, dead} şeklinde olmalıdır.

sgNet.syncDelta(...props): Promise<number>
Yalnızca belirli property'leri senkronize eder. Bant genişliği tasarrufu için kullanışlıdır.

js
await sgNet.syncDelta("x", "y", "angle");
sgNet.startAutoSync(rate?) / sgNet.stopAutoSync()
Otomatik senkronizasyon döngüsünü başlatır/durdurur. rate saniyedeki snapshot sayısıdır (varsayılan 60).

js
sgNet.startAutoSync(20); // saniyede 20 snapshot
// ...
sgNet.stopAutoSync();
5.5. Büyük Veri Gönderimi
sgNet.sendLarge(name, arrayBuffer): Promise<boolean>
Veriyi 8 KB'lik parçalara böler ve peer'lere gönderir. Alıcı tarafta sgNet.on(name, cb) ile dinlenir.

js
// Gönderen
await sgNet.sendLarge("harita", haritaBuffer);

// Alıcı
sgNet.on("harita", (buffer) => {
  console.log("Harita alındı:", buffer.byteLength, "byte");
});
5.6. Ses Akışı
sgNet.startAudio(): Promise<void>
Mikrofon izni ister ve ses akışını başlatır.

sgNet.stopAudio(): void
Ses akışını durdurur.

sgNet.isAudioActive(): boolean
Ses kaydının aktif olup olmadığını döndürür.

sgNet.sendAudio(float32Array): Promise<number>
Float32 ses örneğini gönderir.

js
const samples = new Float32Array(1024);
// ... doldur ...
await sgNet.sendAudio(samples);
5.7. Ağ Kalitesi ve Ölçümler
sgNet.ping(peerId): Promise<number>
Belirtilen peer'e ping atar, RTT'yi (ms) döndürür. Zaman aşımında -1 döner.

js
const rtt = await sgNet.ping(peerId);
console.log(`RTT: ${rtt} ms`);
sgNet.getPing(peerId): number
Son ölçülen RTT'yi döndürür (yoksa -1).

sgNet.getConnectionQuality(): string
Ortalama RTT'ye göre bağlantı kalitesini döndürür:

"excellent" — < 50 ms

"good" — 50–150 ms

"poor" — ≥ 150 ms

"disconnected" — peer yok

sgNet.getPeerInfo(peerId): object | null
Peer hakkında detaylı bilgi döndürür:

js
{
  alias: "ahmet",
  ping: 42,
  connectedAt: 1730000000000,
  messagesSent: 12,
  messagesReceived: 8
}
sgNet.getSessionId(): string
Aktif oturum kimliğini döndürür: server|pass|alias.

sgNet.joinWithSession(sessionId): Promise<object>
Oturum kimliğinden yeniden bağlanır.

js
await sgNet.joinWithSession("oyun-odasi|gizli123|ahmet");
5.8. Yapılandırma
sgNet.setPeerTimeout(ms: number)
Peer zaman aşımı süresi (varsayılan 5000).

sgNet.setCompression(mode: "rle" | "huffman")
Sıkıştırmayı etkinleştirir. huffman şu an deneyseldir (RLE'ye fallback yapar).

sgNet.setBandwidthLimit(bps: number)
Saniyede gönderilebilecek maksimum byte. 0 = sınırsız.

sgNet.getBandwidthUsage(): number
Son 1 saniyede kullanılan bant genişliği.

sgNet.setReconnect(max: number)
Maksimum yeniden bağlanma denemesi (varsayılan 5).

sgNet.setQueue(on: boolean)
Mesaj kuyruğunu etkinleştirir. Peer yokken biriken mesajlar peer geldiğinde sırayla gönderilir.

sgNet.setInterpolation(ms: number)
Entity senkronizasyonunda interpolation süresi (ms). 0 = interpolasyon yok.

sgNet.setRateLimit(perSec: number)
Peer başına saniyede alınabilecek mesaj sayısı. 0 = sınırsız.

sgNet.setTickRate(rate: number)
Tahmin döngüsünün tick hızı (varsayılan 60 Hz).

sgNet.getPredictionBuffer(): Array
Tahmin girdilerinin son 120 kaydını döndürür.

sgNet.typing(on: boolean)
Yazıyor göstergesini gönderir.

js
input.addEventListener("input", () => sgNet.typing(true));
input.addEventListener("blur", () => sgNet.typing(false));

sgNet.on("typing", ({ from, on }) => {
  console.log(`${from} ${on ? "yazıyor..." : "yazmayı bıraktı"}`);
});
sgNet.getStats(): object
Detaylı istatistikleri döndürür (bkz. Bölüm 8).

sgNet._debug: boolean
true yapıldığında konsola log basar.

6. Gelişmiş Özellikler
6.1. Öncelikli Mesaj Kuyruğu
Peer yokken biriken mesajlar, kuyruk etkinse önceliğe göre sıralanıp ilk peer gelişinde gönderilir.

js
sgNet.setQueue(true);

// Peer olmadan gönder
sgNet.out({ chat: "selam" }, "Q").high;
sgNet.out({ background: "veri" }, "Q").low;

// Peer bağlanınca yüksek öncelikli önce gider
6.2. Delta Snapshot
Yalnızca değişen entity alanları gönderilir. İlk snapshot tamdır, sonrakiler delta'dır.

js
// Sadece x, y senkronize et
await sgNet.syncDelta("x", "y");

// Tüm entity'leri senkronize et
await sgNet.sync("Q");
6.3. Bant Genişliği Kontrolü
js
sgNet.setBandwidthLimit(50 * 1024); // 50 KB/s
console.log("Kullanım:", sgNet.getBandwidthUsage(), "byte");
Sınır aşılırsa out(...).onFail() çağrılır ve stats.dropped artar.

6.4. Rate Limit (Alıcı Tarafı)
js
sgNet.setRateLimit(30); // peer başına saniyede 30 mesaj
Sınırı aşan peer'lerin mesajları sessizce yok sayılır.

6.5. Oturum ile Yeniden Bağlanma
js
const sid = sgNet.getSessionId(); // "oda|sifre|alias"
// ... bağlantı koptu ...
await sgNet.joinWithSession(sid);
7. Olaylar (Listener'lar)
Örnek: Tüm temel olayları dinlemek
js
sgNet.on("connected", ({ alias }) => {
  console.log(`👋 ${alias} katıldı`);
});

sgNet.on("left", ({ alias }) => {
  console.log(`👋 ${alias} ayrıldı`);
});

sgNet.on("data", (payload) => {
  console.log("📩 Veri:", payload);
});

sgNet.on("reliable", (payload) => {
  console.log("✅ Güvenilir veri:", payload);
});

sgNet.on("sync", ({ added, updated }) => {
  console.log(`🔄 Sync: +${added} yeni, ${updated} güncel`);
});

sgNet.on("timeout", ({ peerId }) => {
  console.warn(`⏱️ Zaman aşımı: ${peerId}`);
});

sgNet.on("dropped", ({ msgId }) => {
  console.warn(`❌ Mesaj düştü: ${msgId}`);
});
8. İstatistikler
sgNet.getStats() şu bilgileri döndürür:

Alan	Açıklama
sent / received	Toplam paket sayısı
bytesSent / bytesReceived	Toplam byte
syncSent / syncReceived	Senkronizasyon sayısı
audioSent / audioReceived	Ses paketleri
evtSent / evtReceived	Olay sayısı
rolledBack / predicted	Tahmin istatistikleri
bytesSaved	Sıkıştırma ile kazanılan byte
retries / acks	Yeniden deneme ve ACK sayısı
chunksSent / chunksReceived	Parçalanmış veri blokları
dropped	Düşen mesaj sayısı
compressed	Sıkıştırılmış mesaj sayısı
queued	Kuyruğa alınan mesaj sayısı
rateLimited	Rate limit'e takılan sayısı
priorityHigh/Med/Low	Öncelik dağılımı
peers	Aktif peer sayısı
queue	Kuyrukta bekleyen mesaj
js
console.table(sgNet.getStats());
9. Örnekler
9.1. Basit Sohbet Uygulaması
js
await sgNet.join("sohbet", "1234", "kullanici");

sgNet.on("data", (msg) => {
  addMessageToUI(msg.from, msg.text);
});

function gonder(text) {
  sgNet.out({ from: sgNet.getAlias(), text }, "Q").high;
}

// Yazıyor göstergesi
input.addEventListener("input", () => sgNet.typing(true));
sgNet.on("typing", ({ from, on }) => {
  setTypingIndicator(from, on);
});
9.2. Basit Oyun Döngüsü
js
// Entity'leri senkronize et
sgNet.startAutoSync(30);

// Yerel hareket
function update() {
  player.x += input.x * speed;
  player.y += input.y * speed;
}

// Diğer oyuncuları göster (interpolation ile)
sgNet.setInterpolation(100);
sgNet.on("sync", () => renderAllEntities());
9.3. Büyük Harita Transferi
js
// Host
const haritaBuffer = await fetch("harita.bin").then(r => r.arrayBuffer());
await sgNet.sendLarge("harita", haritaBuffer);

// Client
sgNet.on("harita", (buffer) => {
  haritaYukle(buffer);
});
9.4. Bant Genişliği Koruma
js
sgNet.setCompression("rle");
sgNet.setBandwidthLimit(100 * 1024); // 100 KB/s

sgNet.out(buyukVeri, "Q").low.onFail((reason) => {
  if (reason === "bandwidth") {
    console.warn("Bant sınırı aşıldı, sonra tekrar dene");
  }
});
10. Sürüm Notları
v3.2.0 — Mevcut
✨ Mesaj kuyruğu (setQueue)

✨ Interpolasyon (setInterpolation)

✨ Rate limit (setRateLimit)

✨ Peer metadata (getPeerInfo)

✨ Binary event (registerEvent)

✨ Oturum (getSessionId, joinWithSession)

✨ Yazıyor göstergesi (typing)

✨ Delta props (syncDelta)

v3.1.x
Öncelikli kuyruk ve güvenilir mesajlar

Ping / bağlantı kalitesi

Bant genişliği sınırı

v3.0.x
RLE / Huffman sıkıştırma

Chunk tabanlı büyük veri transferi

Ses akışı

Ek: Lisans ve Katkı
SGNET açık kaynak bir deneysel kütüphanesidir. Hata bildirimi ve katkı için issue açabilirsiniz.

📝 Not: Bu doküman sgnet.js kaynak kodunun v3.2.0 sürümüne göre hazırlanmıştır.

Son güncelleme: 2026-10-28
Kütüphane sürümü: 3.2.0