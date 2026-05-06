import os
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()


class ReportDB:
    def __init__(self):
        client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
        self._collection = client[os.getenv("MONGO_DB_NAME", "medicopilot")]["reports"]

    def update_report(self, report_id: str, ai_draft_text: str, confidence_score: float) -> None:
        self._collection.update_one(
            {"_id": report_id},
            {
                "$set": {
                    "aiDraftText": ai_draft_text,
                    "aiConfidenceScore": confidence_score,
                    "status": "REVIEW_NEEDED",
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
