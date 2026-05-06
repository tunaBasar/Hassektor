# MediCopilot 🩺🤖

**Event-Driven Dual-Agent Radiology AI Assistant**

MediCopilot, devlet hastanelerindeki radyoloji departmanlarında yaşanan ve ayları bulan raporlama gecikmelerini çözmek amacıyla tasarlanmış, olay güdümlü (event-driven) ve mikroservis tabanlı bir yapay zeka asistanıdır. Sistem tam otonom bir teşhis aracı değil, **"Maker-Checker" (Üreten ve Denetleyen)** mantığıyla çalışan bir Copilot sistemidir. Temel amacımız, tıbbi güvenlik katmanlarından ödün vermeden MR görüntülerini analiz etmek ve doktor onayına hazır taslaklar sunarak sağlık sistemindeki darboğazı aşmaktır.

---

## 🚨 Problem Tanımı: Neden MediCopilot?

Mevcut sağlık sistemindeki manuel radyoloji iş akışları, doktorlar üzerinde sürdürülemez bir iş yükü yaratırken, hastaların haftalarca veya aylarca sonuç beklemesine neden olmaktadır. Bu gecikmeler, hayati risk taşıyan hastalıkların teşhisini geciktirmekte ve telafisi zor mağduriyetler yaratmaktadır. Aşağıdaki tablo, bu krizin sahadaki gerçek ve belgelenmiş yansımalarını göstermektedir:

| Hasta / Şikayetçi | Kurum / Hastane | Bildirilen Gecikme Süresi | Klinik Şikayet ve Mağduriyet Boyutu / Sonuç |
| :--- | :--- | :--- | :--- |
| **Oktay** | Belirtilmemiş | 8 Ay (3 Ay Sıra + 5 Ay Rapor) | MR çektirmek için 3 ay sıra beklemiş, çekimden sonra 5 ay geçmesine rağmen rapor çıkmamıştır. Toplam 8 aylık tam bir tanı yoksunluğu ve sağlık sorunlarının artması. |
| **Anonim** | Başakşehir Çam ve Sakura Şehir H. | 3 Ay (~90 Gün) | Bel ve ayak MR'ı raporlanmadı. FTR tedavisi aksadı, ağrılar kronikleşti, süreç uzadıkça randevular iptal oldu, doktor değişti. |
| **Yonca** | Diyarbakır Silvan Devlet Hastanesi | Yaklaşık 3 Ay | 5 Şubat çekimli MR, 26 Nisan itibarıyla hala raporlanmamış. Hasta "Sağlığım tehlikede" beyanında bulunmuştur. |
| **Dila** | İzmir Bayraklı Şehir Hastanesi | 1.5 Ay | 1.5 aydır rapor bekleniyor. Hastalığın varlığı, teşhisi ve niteliği bilinemediği için tedavi yapılamıyor. |
| **Selin** | Eskişehir Yunus Emre Devlet H. | 1.5 Ay | 12 Haziran çekimli MR raporu 1.5 aydır çıkmadığı için tedavi süreci sekteye uğramıştır. |
| **Özlem** | Eskişehir Şehir Hastanesi | 1 Ay | Onkoloji hastası. 1 aydır rapor çıkmadığı için kanser tedavi süreci durmuş ve hasta ölümcül risk altına girmiştir. |
| **Derya** | Adana Şehir Hastanesi | 1 Ay | Meme MR raporu çıkmadığı için muhtemel meme kanseri takibi ve teşhisi durmuştur. |
| **İsmail** | Şehit Prof. Dr. İlhan Varank E.A.H. | 1 Ay | Hasta, hastalığının ilerlediğini, bu kadar uzun süre bekletilmenin tıbbi ihmal olduğunu belirtmiştir. |
| **Mehti** | İzmir Şehir Hastanesi | 40 Gün | Hipofiz (beyin) MR'ı 40 gündür yazılmadığı için endokrinolojik/nörolojik beyin lezyonu takibi yapılamamaktadır. |
| **İlhan'ın Kızı** | Ankara Bilkent Şehir Hastanesi | 3 Hafta | Çocuk radyoloji bölümünde çekilen MR yüklenmedi. 12 yaşındaki çocuğun pediyatrik tedavisi uzamış ve tehlikeye girmiştir. |
| **Gülseven** | Belirtilmemiş | Haftalarca | Sürekli baş dönmesi (vertigo / acil nörolojik risk) yaşıyor. Durumun aciliyeti olmasına rağmen sonuç çıkmıyor. |
| **Nihal** | Ankara Bilkent Şehir Hastanesi | Haftalarca | Beyin cerrahisi polikliniği için çekilen hayati beyin MR'ı gecikti. KİBAS veya inme riski altındadır. |
| **İlkim** | Kocaeli Şehir Hastanesi | Günler/Haftalar | Nefes darlığı ile acile başvuru. Gecikmeler, yanlış tanı ve raporlama hataları nedeniyle sağlık durumu hızla kötüleşmiştir. |
| **Şeyma** | Şişli Kolan Hastanesi (Özel) | Sözleşme İhlali (>5 Gün) | Özel hastanede "en geç 5 gün içinde çıkacağı" taahhüt edilen rapor çıkmamış, ortopedik tedavi aksamıştır. |
| **Arzu** | Acıbadem Hastanesi (Özel) | Raporlama Hatası | Gecikmenin yanı sıra yanlış/çelişkili rapor düzenlenmesi nedeniyle hastaya yanlış teşhis konulma riski oluşmuştur. |

#### 📌 Tablo Kaynakları (Gerçek Vaka ve Hukuki Emsaller):
1. https://colcuhukuk.com/tr/Detay/YARGITAY-KARARLARI-IsIgINDA-TIBBi-MALPRAKTiS-KOMPLiKASYON-AYRIMI/5
2. https://www.sikayetvar.com/mr/rapor?page=10
3. https://www.sikayetvar.com/e-nabiz/mr-raporu
4. https://www.reddit.com/r/braincancer/comments/iil2lh/finally_got_mri_result_not_the_best/?tl=tr
5. https://mehmettokar.av.tr/calisma-alanlari/saglik-hukuku/olen-kisinin-saglik-kayitlari-2/
6. https://www.sikayetvar.com/mr/rapor
7. https://www.sikayetvar.com/mr/rapor?page=2
8. https://www.reddit.com/r/medicine/comments/1joomuv/chiropractor_causes_dissection_radiologist_and_er/?tl=tr
9. https://avesis.deu.edu.tr/dosya?id=2cd5ec14-1324-4b00-8f62-495401df38e4
10. https://www.sikayetvar.com/cam-sakura-sehir-hastanesi/mr-raporumun-3-ay-gecikmesi-tedavimi-aksatti
11. https://www.sikayetvar.com/mr/rapor?page=4
12. https://www.reddit.com/r/Sciatica/comments/esznh7/post_2nd_microdiscectomy/?tl=tr
13. https://barandogan.av.tr/blog/tazminat-hukuku/malpraktis-doktor-hatasi-tazminat-davasi-nedir
14. https://www.istabip.org.tr/site_icerik_2016/haberler/aralik2016/iyihekimlik/sunumlar/dr_muzaffer_basak.pdf
15. https://www.sikayetvar.com/e-nabiz/mr-sonuclarinin-gecikmesi-ve-saglik-sorunlari
16. https://www.sikayetvar.com/saglik-bakanligi/saglik-bakanligi-mr-sonucu-cikmadi-1-ay-gecti
17. https://www.sikayetvar.com/kocaeli-sehir-hastanesi/sonuc?page=2
18. https://www.hanyaloglu-acar.av.tr/malpraktis-tazminat/malpraktis-davalarinda-eksik-inceleme-bilirkisilik-sorunu

---

## 🛠 Teknoloji Yığını (2026 Standartları)

Projemiz, güncel, reaktif ve ölçeklenebilir mikroservis standartlarına göre inşa edilmiştir:

* **Frontend (UI Katmanı):** React 20, Vite 7.x, Tailwind CSS v4, Shadcn UI (Dark Mode Default).
* **Backend (Core API Katmanı):** Java 25, Spring Boot 4.0.6, Spring WebFlux (Reaktif).
* **AI Engine (Worker Katmanı):** Python 3.14, LangChain v0.3+, Pydantic v2.
* **Veritabanı:** MongoDB 8.0 (NoSQL Document Store).
* **Message Broker:** Apache Kafka 4.0 (KRaft modunda, Zookeeper'sız).
* **Önbellek & Bildirim:** Redis 8.0 (Pub/Sub mimarisi ile).
* **Altyapı:** Docker & Docker Compose v2.

---

## 🏗 Sistem Mimarisi: Olay Güdümlü Orkestrasyon (Event-Orchestration)

Ağır AI analiz işlemlerinin sistemi bloke etmemesi ve zaman aşımı (timeout) sorunlarını önlemek için, HTTP istek-yanıt döngüsü asenkron Kafka kuyruk mimarisine devredilmiştir.

### Adım Adım Veri Akışı
1.  **Ingestion:** Doktor, arayüz (veya PACS) üzerinden MR görüntüsünü yükler. Java API veriyi lokal volume veya S3'e yazar.
2.  **State Management:** Java API, MongoDB üzerinde durumu `DRAFT` olan bir rapor kaydı oluşturur.
3.  **Event Firing:** Kafka `mri_ingestion_topic` kuyruğuna olay fırlatılır. Frontend'e anında `202 Accepted` dönülür. Ekran donmaz.
4.  **AI Processing:** Python Worker Kafka'yı dinler ve **Dual-Agent** motorunu tetikler:
    * *Drafting Agent (Maker):* Görüntüyü analiz eder, tıbbi taslağı çıkarır.
    * *Safety Agent (Checker):* Taslağı tıp literatürü ile çapraz kontrol eder, halüsinasyonu engeller.
5.  **Completion:** Python Worker işlemi tamamlar, raporu MongoDB'ye kaydeder ve statüyü `REVIEW_NEEDED` yapar.
6.  **Broadcast:** Python servisi, Redis Pub/Sub üzerinden `report_notifications` kanalına "Rapor Hazır" uyarısı geçer.
7.  **Client Update:** Java API, WebSockets yardımıyla React arayüzüne anlık bildirim (push notification) iletir.

---

## 📂 Klasör ve Repository Yapısı

```text
/
├── ARCHITECTURE.md          # Sistem tasarım ve veri sözleşmeleri belgesi
├── docker-compose.yml       # Kafka 4.0(KRaft), Redis 8.0, MongoDB 8.0 tanımları
├── frontend/                # React 20 Uygulaması
│   ├── src/components/      # Shadcn UI bileşenleri
│   ├── src/pages/           # Upload ve Dashboard sayfaları
│   └── src/hooks/           # WebSocket dinleyen custom hook'lar
├── backend-java/            # Spring Boot 4.1 Uygulaması
│   ├── src/main/java/com/medicopilot/
│   ├── controllers/         # Reaktif REST Endpoints
│   ├── services/            # Kafka Producer ve İş Mantığı
│   ├── models/              # MongoDB Entity'leri
│   └── exceptions/          # GlobalExceptionHandler
└── ai-worker-python/        # Python 3.14 Uygulaması
    ├── main.py              # Kafka Consumer loop
    ├── agents/              # DraftingAgent ve SafetyAgent sınıfları
    └── requirements.txt     # Bağımlılıklar (kafka-python, redis, langchain vb.)
