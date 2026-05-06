import os
import json
import logging
import redis
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)


class RedisNotifier:
    def __init__(self):
        self._client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_responses=True,
        )

    def notify(self, report_id: str, patient_id: str) -> int:
        """Redis Pub/Sub ile bildirim gönderir. Dinleyen abone sayısını döner."""
        channel = "report_notifications"
        payload = json.dumps(
            {"reportId": report_id, "patientId": patient_id, "status": "READY"}
        )
        subscribers = self._client.publish(channel, payload)
        if subscribers == 0:
            log.warning(
                f"[{report_id}] Redis publish yapıldı ama 0 abone dinliyor! "
                f"Java backend'in Redis subscriber'ı çalışıyor mu kontrol edin. "
                f"Kanal: {channel}"
            )
        else:
            log.info(f"[{report_id}] Redis publish → {channel} ({subscribers} abone aldı)")
        return subscribers
