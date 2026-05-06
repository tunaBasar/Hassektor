# AI Worker — MediCopilot

Python tabanlı asenkron AI işleme servisi. Kafka'dan MR görüntüsü olayı alır, iki ajanlı pipeline çalıştırır, sonucu MongoDB'ye yazar ve Redis üzerinden Java backend'e bildirir.

## Klasör Yapısı

```
ai-worker-python/
├── main.py              # Kafka consumer loop (giriş noktası)
├── agents/
│   ├── __init__.py
│   ├── drafting_agent.py   # Vision API → Türkçe tıbbi taslak
│   └── safety_agent.py     # Halüsinasyon & tutarsızlık denetimi
├── db.py                # MongoDB işlemleri
├── notifier.py          # Redis Pub/Sub bildirimi
├── data/                # MR görüntülerini buraya koy
├── .env.example         # Ortam değişkeni şablonu
└── requirements.txt
```

## Kurulum

```bash
cd ai-worker-python
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env            # .env düzenle: API key ve bağlantı bilgileri
```

## Çalıştırma

```bash
# Docker servislerini ayağa kaldır (Kafka, MongoDB, Redis)
docker compose up -d

# Worker'ı başlat
python main.py
```

## Model Seçimi

`.env` dosyasında `MODEL_PROVIDER` değerini ayarla:

| Değer    | Model           | API Key          |
|----------|-----------------|------------------|
| `openai` | GPT-4o Vision   | `OPENAI_API_KEY` |
| `gemini` | Gemini 1.5 Flash| `GOOGLE_API_KEY` |

## Pipeline Akışı

```
Kafka mri_ingestion_topic
  │
  ▼
DraftingAgent.run(image_path)
  → Base64 encode → Vision API → Türkçe radyoloji taslağı
  │
  ▼
SafetyAgent.run(draft_text)
  → Halüsinasyon / tutarsızlık kontrolü
  → {"is_safe": bool, "confidence": float, "warnings": [...]}
  │
  ▼
MongoDB: status → REVIEW_NEEDED
  │
  ▼
Redis publish → report_notifications
```

## Hata Yönetimi

- **Dosya bulunamadı / kalıcı hata:** MongoDB'de `AI_FAILED` statüsü, offset commit edilir (DLQ mantığı).
- **Kafka iletişim hatası:** Offset commit edilmez, mesaj yeniden işlenir.
- **Safety agent parse hatası:** Güvenli sayılır, uyarı eklenir.
