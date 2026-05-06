import os
import logging
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)


class ReportDB:
    def __init__(self):
        client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
        self._collection = client[os.getenv("MONGO_DB_NAME", "medicopilot")]["reports"]

    def update_report(self, report_id: str, ai_draft_text: str, confidence_score: float) -> bool:
        """Raporu günceller. Başarılıysa True, eşleşme yoksa False döner."""
        update_payload = {
            "$set": {
                "aiDraftText": ai_draft_text,
                "aiConfidenceScore": confidence_score,
                "status": "REVIEW_NEEDED",
                "updatedAt": datetime.now(timezone.utc),
            }
        }

        # Spring Data MongoDB @Id String → ObjectId olarak saklar
        try:
            oid = ObjectId(report_id)
        except Exception:
            oid = None
            log.warning(f"[{report_id}] ObjectId'ye dönüştürülemedi, string _id ile devam ediliyor.")

        # Deneme 1: ObjectId ile
        if oid:
            result = self._collection.update_one({"_id": oid}, update_payload)
            log.info(
                f"[{report_id}] ObjectId sorgusu → matched={result.matched_count}, modified={result.modified_count}"
            )
            if result.matched_count > 0:
                return True

        # Deneme 2: Plain string ile (fallback)
        result = self._collection.update_one({"_id": report_id}, update_payload)
        log.info(
            f"[{report_id}] String sorgusu → matched={result.matched_count}, modified={result.modified_count}"
        )
        if result.matched_count > 0:
            return True

        # Her iki deneme de başarısız — tanılama bilgisi yaz
        doc_count = self._collection.count_documents({})
        sample = self._collection.find_one({}, {"_id": 1, "status": 1})
        log.error(
            f"[{report_id}] MongoDB güncelleme BAŞARISIZ! "
            f"Koleksiyonda toplam {doc_count} doküman var. "
            f"Örnek _id tipi: {type(sample['_id']).__name__ if sample else 'BOŞ KOLEKSİYON'}"
        )
        return False
