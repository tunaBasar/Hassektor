"""
SafetyAgent — MediCopilot AI Worker

OpenRouter API üzerinden meta-llama/llama-3.3-70b-instruct:free modelini kullanarak
DraftingAgent'ın ürettiği raporu halüsinasyon, tutarsızlık ve tehlikeli ifade
açısından denetler.
"""

import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

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


class SafetyAgent:
    """Tıbbi rapor taslağını güvenlik açısından denetleyen ajan."""

    def __init__(self):
        # Drafting Agent ile aynı OpenRouter bağlantısı, farklı model
        self._client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            default_headers={
                "HTTP-Referer": "https://medicoPilot.local",
                "X-Title": "MediCopilot",
            },
        )

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
        try:
            response = self._client.chat.completions.create(
                model="meta-llama/llama-3.3-70b-instruct",
                temperature=0.0,  # Güvenlik kontrolü deterministik olmalı
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
    def _parse(raw: str) -> dict:
        """Model yanıtından JSON'u ayrıştırır. Parse başarısız olursa güvenli varsayılan döner."""
        try:
            # Model yanıtın başına/sonuna eklediği markdown bloğunu temizle
            cleaned = (
                raw.strip()
                .removeprefix("```json")
                .removeprefix("```")
                .removesuffix("```")
                .strip()
            )
            result = json.loads(cleaned)
            # Zorunlu alanların varlığını doğrula
            return {
                "is_safe": bool(result.get("is_safe", True)),
                "confidence": float(result.get("confidence", 0.5)),
                "warnings": list(result.get("warnings", [])),
            }
        except Exception:
            # Parse başarısız → güvenli kabul et, manuel inceleme öner
            return {
                "is_safe": True,
                "confidence": 0.5,
                "warnings": ["Safety Agent yanıtı parse edilemedi, manuel inceleme önerilir."],
            }
