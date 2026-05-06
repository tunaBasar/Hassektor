"""
main.py — MediCopilot AI Worker Giriş Noktası

Kafka'dan mri_ingestion_topic topic'ini dinler. Her mesaj için:
  1. DraftingAgent ile Türkçe tıbbi taslak rapor üretir.
  2. SafetyAgent ile raporu halüsinasyon/tutarsızlık açısından denetler.
  3. Sonuca göre MongoDB'yi günceller ve Redis üzerinden bildirim gönderir.

Worker hiçbir hata durumunda çökmez; hata detayları loglanır.
"""

import os
import json
import logging
from kafka import KafkaConsumer
from kafka.errors import KafkaError
from dotenv import load_dotenv

from agents import DraftingAgent, SafetyAgent
from db import ReportDB
from notifier import RedisNotifier

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)


def _safe_json_deserializer(raw_bytes: bytes):
    """Bozuk/boş mesajlarda crash yerine None döndürür."""
    try:
        return json.loads(raw_bytes.decode("utf-8"))
    except Exception:
        log.warning(f"Kafka mesajı JSON olarak parse edilemedi, atlanıyor. ham={raw_bytes!r}")
        return None


def main() -> None:
    log.info("MediCopilot AI Worker başlatılıyor...")

    drafting_agent = DraftingAgent()
    safety_agent = SafetyAgent()
    db = ReportDB()
    notifier = RedisNotifier()

    consumer = KafkaConsumer(
        "mri_ingestion_topic",
        bootstrap_servers=os.getenv("KAFKA_BROKER", "localhost:9092"),
        group_id="medicopilot-ai-worker",
        auto_offset_reset="earliest",
        enable_auto_commit=False,  # Manuel commit: hata durumunda offset ilerlememeli
        value_deserializer=_safe_json_deserializer,
    )

    log.info("Kafka dinleniyor → mri_ingestion_topic")

    for message in consumer:
        payload = message.value

        # Bozuk mesajları atla (Dead Letter mantığı)
        if payload is None:
            log.warning(f"Geçersiz mesaj atlanıyor: partition={message.partition}, offset={message.offset}")
            consumer.commit()
            continue

        report_id = payload.get("reportId", "bilinmiyor")
        patient_id = payload.get("patientId", "bilinmiyor")
        image_path = payload.get("imagePath", "")

        log.info(f"[{report_id}] Yeni mesaj alındı | hasta={patient_id} | görüntü={image_path}")

        # Adım 1: Taslak rapor üretimi
        draft_text = None
        try:
            draft_text = drafting_agent.run(image_path)
            log.info(f"[{report_id}] Taslak rapor başarıyla üretildi.")
        except FileNotFoundError as fnf:
            log.error(f"[{report_id}] {fnf}")
            consumer.commit()
            continue
        except PermissionError as pe:
            log.error(f"[{report_id}] {pe}")
            consumer.commit()
            continue
        except Exception as exc:
            log.error(f"[{report_id}] Taslak üretimi başarısız: {exc}")
            consumer.commit()
            continue

        # Adım 2: Güvenlik denetimi
        try:
            safety_result = safety_agent.check(draft_text)
            is_safe = safety_result.get("is_safe", True)
            confidence = safety_result.get("confidence", 0.5)
            warnings = safety_result.get("warnings", [])
            log.info(
                f"[{report_id}] Güvenlik denetimi tamamlandı | "
                f"güvenli={is_safe} | güven={confidence:.2f} | uyarılar={warnings}"
            )
        except Exception as exc:
            log.error(f"[{report_id}] Güvenlik denetimi başarısız: {exc}")
            consumer.commit()
            continue

        # Adım 3: Sonuca göre MongoDB güncelleme ve bildirim
        try:
            final_confidence = confidence if is_safe else 0.3
            if not is_safe:
                log.warning(
                    f"[{report_id}] Rapor güvensiz bulundu, düşük güvenle kaydediliyor. "
                    f"Uyarılar: {warnings}"
                )

            db_ok = db.update_report(report_id, draft_text, final_confidence)

            if not db_ok:
                log.error(
                    f"[{report_id}] MongoDB güncelleme BAŞARISIZ — bildirim gönderilmeyecek. "
                    f"report_id={report_id!r} değerini MongoDB'de kontrol edin."
                )
                consumer.commit()
                continue

            log.info(f"[{report_id}] MongoDB güncellendi → REVIEW_NEEDED (güven={final_confidence:.2f})")

            notifier.notify(report_id, patient_id)
        except KafkaError as exc:
            # Kafka hatası: offset commit etme, mesaj yeniden işlenecek
            log.critical(f"[{report_id}] Kafka hatası, offset commit edilmiyor: {exc}")
            continue
        except Exception as exc:
            log.error(f"[{report_id}] Kayıt veya bildirim adımında hata: {exc}")

        try:
            consumer.commit()
            log.info(f"[{report_id}] Offset commit edildi. İşlem tamamlandı.")
        except Exception as exc:
            log.error(f"[{report_id}] Offset commit başarısız: {exc}")


if __name__ == "__main__":
    main()
