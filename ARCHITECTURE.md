```markdown
# ARCHITECTURE.md - MediCopilot: Event-Driven Dual-Agent Radiology AI

## 1. PROJE VİZYONU
MediCopilot, devlet hastanelerindeki radyoloji departmanlarında yaşanan raporlama gecikmelerini çözmek amacıyla tasarlanmış, olay güdümlü (event-driven) ve mikroservis tabanlı bir yapay zeka asistanıdır. Sistem tam otonom bir teşhis aracı değil, **"Maker-Checker" (Üreten ve Denetleyen)** mantığıyla çalışan bir Copilot (Asistan) sistemidir. Projenin temel amacı, güvenlik katmanlarından ödün vermeden MR görüntülerini analiz etmek ve doktor onayına hazır taslaklar sunmaktır.

## 2. TEKNOLOJİ YIĞINI (2026 STANDARTLARI)
Bu projede görev alan tüm AI kodlama ajanları (Cursor, Claude, vb.), kod üretirken kesinlikle aşağıdaki güncel sürüm standartlarına uymalıdır:

*   **Frontend (UI Katmanı):** React 20, Vite 7.x, Tailwind CSS v4, Shadcn UI (Dark Mode Default).
*   **Backend (Core API Katmanı):** Java 25, Spring Boot 4.0.6, Spring WebFlux (Reaktif).
*   **AI Engine (Worker Katmanı):** Python 3.14, LangChain v0.3+, Pydantic v2.
*   **Veritabanı (NoSQL):** MongoDB 8.0.
*   **Message Broker:** Apache Kafka 4.0 (Zookeeper KESİNLİKLE YOK, KRaft modu kullanılacak).
*   **Önbellek & Canlı Bildirim:** Redis 8.0.
*   **Konteynerleştirme:** Docker & Docker Compose v2.

---

## 3. SİSTEM MİMARİSİ VE VERİ AKIŞI (EVENT-ORCHESTRATION)

Sistem asenkron mikroservis mimarisi üzerine kuruludur. Zaman aşımı (timeout) sorunlarını önlemek için ağır yapay zeka işlemleri HTTP request/response döngüsünden çıkarılmış, Kafka üzerinden kuyruğa alınmıştır.

### Akış Senaryosu:
1.  **Ingestion:** Doktor (veya PACS Simülatörü) Frontend üzerinden MR resmi yükler. Java API bu resmi alır, yerel volume'a (veya S3) kaydeder.
2.  **State Management:** Java API, MongoDB'de "DRAFT" statüsünde bir rapor kaydı oluşturur.
3.  **Event Firing:** Java API, `mri_ingestion_topic` isimli Kafka kuyruğuna `{reportId, imagePath}` fırlatır ve Frontend'e "İşlem Kuyrukta" (202 Accepted) döner.
4.  **AI Processing (Python Worker):** Python servisi Kafka'yı dinler. Görüntüyü alır ve Multi-Agent hattını çalıştırır:
    *   *Ajan 1 (Drafting Agent):* Görüntüyü analiz edip tıbbi taslak üretir.
    *   *Ajan 2 (Safety/Checker Agent):* Üretilen metni tıp literatürü ve güvenlik (halüsinasyon) açısından denetler.
5.  **Completion & Notification:** Python worker işlemi bitirince MongoDB'deki kaydı günceller (ai_text'i yazar, statüyü "REVIEW_NEEDED" yapar).
6.  **Real-Time Broadcast:** Python worker, Redis Pub/Sub üzerinden `report_notifications` kanalına "Rapor Hazır" mesajı fırlatır.
7.  **Client Update:** Java API (WebSocket üzerinden) Redis'i dinler ve React Frontend'e "Yeni rapor düştü" sinyali gönderir.

---

## 4. VERİ SÖZLEŞMELERİ VE ŞEMALAR (CONTRACTS)

Tüm servisler arasındaki haberleşme aşağıdaki şemalara (Schema) sıkı sıkıya bağlı kalacaktır.

### 4.1. MongoDB `reports` Koleksiyonu
```json
{
  "_id": "ObjectId('...')",
  "patientId": "String (Örn: P-1024)",
  "imagePath": "String (Dosya yolu veya S3 URI)",
  "aiDraftText": "String (Ajanların ürettiği taslak metin)",
  "aiConfidenceScore": "Double (0.0 - 1.0 arası)",
  "doctorFinalText": "String (Doktor onayladığında dolacak)",
  "status": "String (DRAFT | REVIEW_NEEDED | APPROVED)",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### 4.2. Kafka Topics & Payloads
*   **Topic:** `mri_ingestion_topic`
*   **Producer:** Java Backend API
*   **Consumer:** Python AI Worker
*   **Payload:**
```json
{
  "reportId": "60d5ec...",
  "patientId": "P-1024",
  "imagePath": "/data/mri/scan_1024.png",
  "timestamp": "2026-05-06T10:00:00Z"
}
```

### 4.3. Redis Pub/Sub Kanalları
*   **Channel:** `report_notifications`
*   **Publisher:** Python AI Worker
*   **Subscriber:** Java Backend (WebSocket üzerinden React'e aktarmak için)
*   **Payload:**
```json
{
  "reportId": "60d5ec...",
  "patientId": "P-1024",
  "status": "READY"
}
```

### 4.4. Standart API Yanıt Yapısı (ApiResponse)
Tüm REST endpoint'leri (başarılı veya başarısız) standart bir sarmalayıcı (wrapper) obje dönmek zorundadır. Yapay zeka ajanları tüm controller sınıflarında `ResponseEntity<ApiResponse<T>>` yapısını kullanmalıdır.

**Başarılı Yanıt Örneği (200 OK):**
```json
{
  "success": true,
  "message": "Görüntü başarıyla kuyruğa alındı.",
  "data": {
    "reportId": "60d5ec...",
    "status": "DRAFT"
  },
  "errorCode": null,
  "timestamp": "2026-05-06T10:00:00.000Z"
}
```

**Hata Yanıtı Örneği (400 / 404 / 500):**
```json
{
  "success": false,
  "message": "Hasta kaydı bulunamadı.",
  "data": null,
  "errorCode": "PATIENT_NOT_FOUND",
  "timestamp": "2026-05-06T10:05:00.000Z"
}
```

### 4.5. Detaylı Varlık (Entity) Şemaları (Java Spring Data MongoDB İçin)
AI ajanlarının veri modellerini doğru kurabilmesi için Java sınıflarındaki alanlar, tipler ve validasyonlar aşağıdaki gibi yapılandırılacaktır. Tüm entity'lerde `@Document` anotasyonu kullanılacaktır.

**1. Report (Rapor) Entity'si:**
*   `id`: String (MongoDB ObjectId)
*   `patientId`: String (Zorunlu, `@Indexed` olmalı)
*   `doctorId`: String (Opsiyonel, onaylayan doktorun ID'si)
*   `imagePath`: String (Zorunlu, S3 veya Local Path)
*   `aiDraftText`: String (AI tarafından üretilen Markdown metin)
*   `aiConfidenceScore`: Double (0.00 - 1.00 arası)
*   `doctorFinalText`: String (Doktorun düzenlediği/onayladığı son metin)
*   `status`: Enum (`ReportStatus.DRAFT`, `ReportStatus.REVIEW_NEEDED`, `ReportStatus.APPROVED`)
*   `createdAt`: Instant (MongoDB'de otomatik oluşturulacak)
*   `updatedAt`: Instant (@LastModifiedDate ile otomatik güncellenecek)

**2. Patient (Hasta) Entity'si:**
*   `id`: String (MongoDB ObjectId)
*   `nationalId`: String (Şifrelenmiş tutulacak)
*   `firstName`: String (Zorunlu)
*   `lastName`: String (Zorunlu)
*   `dateOfBirth`: LocalDate
*   `gender`: Enum (`Gender.MALE`, `Gender.FEMALE`, `Gender.OTHER`)

---

## 5. UÇ NOKTALAR (REST & WEBSOCKET ENDPOINTS)

### Backend (Java Spring Boot 4.1)
*   `POST /api/v1/mri/upload` (Multipart form-data: `file`, `patientId`)
*   `GET /api/v1/reports?status=REVIEW_NEEDED` (Bekleyen raporları listeler)
*   `GET /api/v1/reports/{reportId}` (Tekil rapor detayı)
*   `PUT /api/v1/reports/{reportId}` (JSON Payload: `{ doctorFinalText: "...", status: "APPROVED" }`)
*   `WS /ws/notifications` (Frontend'in canlı bildirimleri dinleyeceği WebSocket bağlantısı)

### 5.1. Backend İstisna Yönetimi (GlobalExceptionHandler)
Spring Boot 4.1.x arka yüzünde hata fırlatma (exception handling) işlemleri merkezi olarak yönetilecektir. Yapay zeka ajanları `try-catch` bloklarıyla controller'ı kirletmemeli, bunun yerine özel istisnalar (Custom Exceptions) fırlatmalı ve bu istisnalar `@RestControllerAdvice` işaretli `GlobalExceptionHandler` sınıfında yakalanmalıdır.

**Standart İstisna Sınıfları ve Dönüş Kodları:**
1.  `ResourceNotFoundException`: (HTTP 404) - Veritabanında kayıt bulunamadığında fırlatılır. (Örn: `errorCode: "NOT_FOUND"`)
2.  `ValidationException`: (HTTP 400) - İstek parametreleri veya DTO doğrulamaları başarısız olduğunda fırlatılır. (Örn: `errorCode: "VALIDATION_ERROR"`)
3.  `AIProcessingTimeoutException`: (HTTP 503) - AI servisi Kafka kuyruğunda belirlenen sürede (örn: 5 dk) yanıt vermezse fırlatılır. (Örn: `errorCode: "AI_TIMEOUT"`)
4.  `UnauthorizedActionException`: (HTTP 403) - Doktor yetkisi olmayan bir raporu onaylamaya çalıştığında fırlatılır. (Örn: `errorCode: "FORBIDDEN"`)

**GlobalExceptionHandler Şablon Kuralları:**
AI ajanı `GlobalExceptionHandler` sınıfını oluştururken tüm exception handler metotlarının `ResponseEntity<ApiResponse<Void>>` dönmesini ve `timestamp` değerinin tam o anki `Instant.now()` değerini almasını sağlamalıdır.

---

## 6. KLASÖR VE REPO YAPISI
AI kodlama ajanları, dosyaları oluştururken aşağıdaki dizin yapısına kesinlikle riayet etmelidir:
```text
/
├── ARCHITECTURE.md          # Sistem tasarım belgesi
├── docker-compose.yml       # Kafka 4.0(KRaft), Redis 8.0, MongoDB 8.0 tanımları
├── frontend/                # React 20 Uygulaması
│   ├── src/components/      # Shadcn UI bileşenleri
│   ├── src/pages/           # Upload ve Dashboard sayfaları
│   └── src/hooks/           # WebSocket dinleyen custom hook'lar
├── backend-java/            # Spring Boot 4.1 Uygulaması
│   ├── src/main/java/com/medicopilot/
│   │   ├── controllers/     # REST Endpoints
│   │   ├── services/        # Kafka Producer ve İş Mantığı
│   │   ├── config/          # WebSocket, Kafka ve Mongo Ayarları
│   │   ├── models/          # MongoDB Entity'leri
│   │   └── exceptions/      # GlobalExceptionHandler ve Custom Exceptions eklendi
└── ai-worker-python/        # Python 3.14 Uygulaması
    ├── main.py              # Kafka Consumer loop
    ├── agents/              # DraftingAgent ve SafetyAgent sınıfları
    ├── db.py                # Pymongo MongoDB bağlantıları
    └── requirements.txt     # Bağımlılıklar (kafka-python, redis, openai/langchain vb.)
```

## 7. AI GELİŞTİRİCİ DİREKTİFLERİ (SYSTEM PROMPT RULES)
*Bu dosyayı okuyan tüm AI ajanları (Cursor, Claude Code, vb.) kod üretirken aşağıdaki kurallara uyacaktır:*
1.  **Kurumsal Temizlik:** Java kodlarında bağımlılık enjeksiyonu (DI) ve katmanlı mimari (Controller -> Service -> Repository) kesinlikle uygulanacaktır.
2.  **Asenkron Tolerans:** Python worker çökerse, Kafka partition'ındaki offset'i commitlememeli, hata loglanıp mesaj "Dead Letter Queue" mantığıyla ayrılmalıdır.
3.  **Modern UI:** React kodlarında gereksiz re-render'lardan kaçınılmalı, Tailwind sınıfları semantik kullanılmalıdır.
```