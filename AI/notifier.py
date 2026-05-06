import os
import json
import redis
from dotenv import load_dotenv

load_dotenv()


class RedisNotifier:
    def __init__(self):
        self._client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_responses=True,
        )

    def notify(self, report_id: str, patient_id: str) -> None:
        payload = json.dumps(
            {"report_id": report_id, "patient_id": patient_id, "status": "READY"}
        )
        self._client.publish("report_notifications", payload)
