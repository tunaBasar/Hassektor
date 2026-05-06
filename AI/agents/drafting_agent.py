"""
DraftingAgent — MediCopilot AI Worker

OpenRouter API üzerinden meta-llama/llama-4-scout:free (vision destekli) modelini
kullanarak MRI görüntüsünü analiz eder ve Türkçe tıbbi rapor taslağı üretir.
"""

import os
import base64
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

_SYSTEM_PROMPT = (
    "Sen bir radyoloji uzmanı yapay zekasısın. "
    "MRI görüntülerini analiz ederek Türkçe detaylı tıbbi rapor yazıyorsun."
)

_USER_PROMPT = """Sana verilen MRI görüntüsünü analiz et. YALNIZCA aşağıdaki formatta Türkçe rapor yaz, başka hiçbir şey ekleme:

Görüntü Bölgesi: [Hangi anatomik bölge olduğunu yaz]
Görüntü Kalitesi: [İyi / Orta / Düşük ve kısa açıklama]
Gözlemlenen Bulgular: [Görüntüdeki tüm yapıları teknik terimleriyle açıkla]
Anormallik Şüphesi: [Var / Yok]
Açıklama: [Anormallik varsa detaylı açıkla, "olabilir", "şüphelidir" gibi ihtiyatlı ifadeler kullan]
Öneri: [Radyoloğun yapması gereken takip adımlarını yaz]
UYARI: Bu rapor AI taslağıdır, radyolog onayı zorunludur."""


class DraftingAgent:
    """MRI görüntüsünü analiz edip Türkçe tıbbi taslak rapor üreten ajan."""

    def __init__(self):
        # OpenRouter, OpenAI-compatible API sunar — sadece base_url ve header farkı var
        self._client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            default_headers={
                "HTTP-Referer": "https://medicoPilot.local",
                "X-Title": "MediCopilot",
            },
        )

    def run(self, image_path: str) -> str:
        """
        Verilen görüntü dosyasını analiz eder.

        Args:
            image_path: MRI görüntüsünün dosya yolu.

        Returns:
            Türkçe tıbbi rapor taslağı (str).

        Raises:
            FileNotFoundError: Görüntü dosyası bulunamazsa.
            RuntimeError: API çağrısı başarısız olursa.
        """
        if not Path(image_path).exists():
            raise FileNotFoundError(f"Görüntü dosyası bulunamadı: {image_path}")

        # Görüntüyü base64'e çevir
        encoded = self._encode_image(image_path)
        mime = self._mime_type(image_path)
        data_url = f"data:{mime};base64,{encoded}"

        try:
            response = self._client.chat.completions.create(
                model="google/gemma-4-26b-a4b-it",
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url}},
                            {"type": "text", "text": _USER_PROMPT},
                        ],
                    },
                ],
            )
            return response.choices[0].message.content
        except Exception as exc:
            raise RuntimeError(f"Drafting Agent API çağrısı başarısız: {exc}") from exc

    @staticmethod
    def _encode_image(image_path: str) -> str:
        """Görüntü dosyasını base64 string'e çevirir."""
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    @staticmethod
    def _mime_type(image_path: str) -> str:
        """Dosya uzantısına göre MIME türü döndürür."""
        suffix = Path(image_path).suffix.lower()
        mapping = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
        return mapping.get(suffix, "image/png")
