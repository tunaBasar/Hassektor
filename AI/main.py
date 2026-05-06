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
        value_deserializer=lambda b: json.loads(b.decode("utf-8")),
    )

    log.info("Kafka dinleniyor → mri_ingestion_topic")

    for message in consumer:
        payload = message.value
        report_id = payload.get("report_id", "bilinmiyor")
        patient_id = payload.get("patient_id", "bilinmiyor")
        image_path = payload.get("image_path", "")

        log.info(f"[{report_id}] Yeni mesaj alındı | hasta={patient_id} | görüntü={image_path}")

        # Adım 1: Taslak rapor üretimi
        draft_text = None
        try:
            draft_text = drafting_agent.run(image_path)
            log.info(f"[{report_id}] Taslak rapor başarıyla üretildi.")
        except FileNotFoundError:
            log.error(f"[{report_id}] Görüntü dosyası bulunamadı: {image_path} — mesaj atlanıyor.")
            consumer.commit()  # Geçersiz mesaj, Dead Letter mantığı: tekrar deneme anlamsız
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
            if is_safe:
                db.update_report(report_id, draft_text, confidence)
                log.info(f"[{report_id}] MongoDB güncellendi → REVIEW_NEEDED")

                notifier.notify(report_id, patient_id)
                log.info(f"[{report_id}] Redis bildirimi gönderildi → report_notifications")
            else:
                log.warning(
                    f"[{report_id}] Rapor güvensiz bulundu, doktor bildirimi gönderilmiyor. "
                    f"Uyarılar: {warnings}"
                )
                # Düşük güven skoru ile yaz, manuel inceleme için beklet
                db.update_report(report_id, draft_text, 0.3)
                log.info(f"[{report_id}] MongoDB güncellendi → REVIEW_NEEDED (güven=0.3, manuel inceleme gerekli)")
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
