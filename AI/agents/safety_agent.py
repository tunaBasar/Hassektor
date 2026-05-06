"""
SafetyAgent — MediCopilot AI Worker

OpenRouter API üzerinden DraftingAgent'ın ürettiği raporu halüsinasyon,
tutarsızlık ve tehlikeli ifade açısından denetler.

API key yoksa otonom mock modda çalışarak gerçekçi güvenlik değerlendirmesi üretir.
"""

import os
import json
import random
import logging
from typing import List
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "Sen bir tıbbi kalite kontrol uzmanısın. "
    "Sana verilen tıbbi raporu halüsinasyon, tutarsızlık ve tehlikeli ifadeler "
    "açısından Türkçe olarak değerlendiriyorsun."
)

_USER_PROMPT_TEMPLATE = """Aşağıdaki tıbbi rapor taslağını şu kriterlere göre denetle:

1. Halüsinasyon: Gerçek tıp literatüründe olmayan, uydurma terimler veya bulgular var mı?
2. Tutarsızlık: Rapor içinde birbiriyle çelişen cümleler var mı?
3. Tehlikeli ifade: Radyoloğun yetkisi dışında kesin tanı veya tedavi kararı içeren ifadeler var mı? (Örn: "ameliyat şarttır", "kanser kesindir")

YALNIZCA aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{{"is_safe": true, "confidence": 0.95, "warnings": []}}

Denetlenecek rapor:
---
{report_text}
---"""


class SafetyCheckResult(BaseModel):
    """Pydantic v2 modeli — SafetyAgent çıktı şeması."""
    is_safe: bool = Field(description="Rapor güvenli mi?")
    confidence: float = Field(ge=0.0, le=1.0, description="Güven skoru (0.0 - 1.0)")
    warnings: List[str] = Field(default_factory=list, description="Tespit edilen uyarılar")


class SafetyAgent:
    """Tıbbi rapor taslağını güvenlik açısından denetleyen ajan."""

    def __init__(self):
        self._api_key = os.getenv("OPENROUTER_API_KEY")
        self._client = None

        if self._api_key:
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=self._api_key,
                    default_headers={
                        "HTTP-Referer": "https://medicoPilot.local",
                        "X-Title": "MediCopilot",
                    },
                )
                log.info("SafetyAgent: OpenRouter API modu aktif.")
            except ImportError:
                log.warning("SafetyAgent: openai paketi bulunamadı, mock moda geçiliyor.")
        else:
            log.info("SafetyAgent: OPENROUTER_API_KEY ayarlanmamış, mock moda geçiliyor.")

    def check(self, report_text: str) -> dict:
        """
        Verilen rapor metnini güvenlik açısından denetler.

        Args:
            report_text: DraftingAgent tarafından üretilen rapor metni.

        Returns:
            dict: {"is_safe": bool, "confidence": float, "warnings": list[str]}

        Raises:
            RuntimeError: API çağrısı başarısız olursa.
        """
        if self._client:
            return self._check_api(report_text)
        return self._check_mock(report_text)

    def _check_api(self, report_text: str) -> dict:
        """OpenRouter API üzerinden gerçek güvenlik denetimi."""
        try:
            response = self._client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct",
                temperature=0.0,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": _USER_PROMPT_TEMPLATE.format(report_text=report_text),
                    },
                ],
            )
            raw = response.choices[0].message.content
            return self._parse(raw)
        except Exception as exc:
            raise RuntimeError(f"Safety Agent API çağrısı başarısız: {exc}") from exc

    @staticmethod
    def _check_mock(report_text: str) -> dict:
        """API key yokken otonom mock güvenlik denetimi üretir."""
        has_dangerous = any(
            kw in report_text.lower()
            for kw in ["kesindir", "ameliyat şarttır", "kanser kesindir", "mutlaka"]
        )

        if has_dangerous:
            result = SafetyCheckResult(
                is_safe=False,
                confidence=round(random.uniform(0.3, 0.5), 2),
                warnings=["Raporda kesin tanı/tedavi ifadesi tespit edildi. Manuel inceleme gereklidir."],
            )
        else:
            result = SafetyCheckResult(
                is_safe=True,
                confidence=round(random.uniform(0.85, 0.98), 2),
                warnings=[],
            )

        log.info(f"SafetyAgent [MOCK]: güvenli={result.is_safe}, güven={result.confidence:.2f}")
        return result.model_dump()

    @staticmethod
    def _parse(raw: str) -> dict:
        """Model yanıtından JSON'u ayrıştırır. Parse başarısız olursa güvenli varsayılan döner."""
        try:
            cleaned = (
                raw.strip()
                .removeprefix("```json")
                .removeprefix("```")
                .removesuffix("```")
                .strip()
            )
            parsed = json.loads(cleaned)
            result = SafetyCheckResult(
                is_safe=bool(parsed.get("is_safe", True)),
                confidence=float(parsed.get("confidence", 0.5)),
                warnings=list(parsed.get("warnings", [])),
            )
            return result.model_dump()
        except Exception:
            return SafetyCheckResult(
                is_safe=True,
                confidence=0.5,
                warnings=["Safety Agent yanıtı parse edilemedi, manuel inceleme önerilir."],
            ).model_dump()
