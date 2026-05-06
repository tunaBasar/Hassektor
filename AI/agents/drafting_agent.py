"""
DraftingAgent — MediCopilot AI Worker

OpenRouter API üzerinden vision destekli modeli kullanarak MRI görüntüsünü analiz
eder ve Türkçe tıbbi rapor taslağı üretir.

API key yoksa (OPENROUTER_API_KEY ayarlanmamışsa) otonom mock modda çalışır ve
gerçekçi sahte tıbbi metin üretir.
"""

import os
import random
import base64
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)

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


class DraftReport(BaseModel):
    """Pydantic v2 modeli — DraftingAgent çıktı şeması."""
    image_region: str = Field(description="Anatomik bölge")
    image_quality: str = Field(description="Görüntü kalitesi değerlendirmesi")
    findings: str = Field(description="Gözlemlenen bulgular")
    anomaly_suspected: bool = Field(description="Anormallik şüphesi var mı")
    explanation: str = Field(description="Detaylı açıklama")
    recommendation: str = Field(description="Takip önerileri")


_MOCK_REPORTS = [
    DraftReport(
        image_region="Kranial (Beyin) MRG",
        image_quality="İyi — T1 ve T2 ağırlıklı sekanslar değerlendirilmiştir.",
        findings="Sağ frontal lobda 12mm çapında, çevre dokudan belirgin kontrast tutan, düzgün sınırlı lezyon izlenmektedir. Perilezyonel ödem mevcut olup orta hat yapılarında minimal sola itilme gözlenmektedir.",
        anomaly_suspected=True,
        explanation="Sağ frontal lobda saptanan kontrast tutan lezyon, düşük gradlı gliom veya menenjiyom ile uyumlu olabilir. Kesin ayırıcı tanı için ileri tetkik önerilir. Perilezyonel ödemin varlığı şüphelidir ve klinik korelasyon gerektirir.",
        recommendation="Kontrastlı MR Spektroskopi ve Perfüzyon MR ile ileri değerlendirme önerilir. Beyin cerrahisi konsültasyonu planlanmalıdır. 3 ay sonra kontrol MR çekilmesi uygun olacaktır.",
    ),
    DraftReport(
        image_region="Lomber Vertebra MRG",
        image_quality="Orta — Hareket artefaktı minimal düzeyde mevcuttur.",
        findings="L4-L5 intervertebral disk mesafesinde posterior santral disk protrüzyonu izlenmektedir. Protrüzyon 5mm boyutunda olup teka sakına bası uygulamaktadır. L5-S1 seviyesinde annüler yırtık şüphesi mevcuttur.",
        anomaly_suspected=True,
        explanation="L4-L5 seviyesindeki disk protrüzyonu, hastanın bel ağrısı ve olası radikülopati bulguları ile uyumlu olabilir. Nöral foramen daralması şüphelidir, klinik muayene ile korelasyon önerilir.",
        recommendation="Fizik tedavi programı başlanması, ağrı kontrolü ve 6 hafta sonra klinik değerlendirme önerilir. Semptomların ilerlemesi halinde EMG incelemesi düşünülmelidir.",
    ),
    DraftReport(
        image_region="Diz Eklemi MRG",
        image_quality="İyi — PD FS ve T1 sekanslar yeterli kalitededir.",
        findings="Medial menisküs posterior hornunda Grade III sinyal artışı izlenmektedir. Ön çapraz bağ (ACL) lifleri düzensiz ve ödemli görünmektedir. Eklem içi minimal efüzyon mevcuttur.",
        anomaly_suspected=True,
        explanation="Medial menisküs yırtığı ve ACL parsiyel rüptürü ile uyumlu bulgular şüphelidir. Lateral menisküs ve arka çapraz bağ normal sınırlardadır. Kıkırdak yüzeylerde belirgin defekt saptanmamıştır.",
        recommendation="Ortopedi konsültasyonu ve klinik stabilite testleri önerilir. Konservatif tedaviye yanıt alınamaz ise artroskopik cerrahi değerlendirme planlanmalıdır.",
    ),
]


def _format_report(report: DraftReport) -> str:
    """DraftReport Pydantic modelini düz metin formatına çevirir."""
    return (
        f"Görüntü Bölgesi: {report.image_region}\n"
        f"Görüntü Kalitesi: {report.image_quality}\n"
        f"Gözlemlenen Bulgular: {report.findings}\n"
        f"Anormallik Şüphesi: {'Var' if report.anomaly_suspected else 'Yok'}\n"
        f"Açıklama: {report.explanation}\n"
        f"Öneri: {report.recommendation}\n"
        f"UYARI: Bu rapor AI taslağıdır, radyolog onayı zorunludur."
    )


class DraftingAgent:
    """MRI görüntüsünü analiz edip Türkçe tıbbi taslak rapor üreten ajan."""

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
                log.info("DraftingAgent: OpenRouter API modu aktif.")
            except ImportError:
                log.warning("DraftingAgent: openai paketi bulunamadı, mock moda geçiliyor.")
        else:
            log.info("DraftingAgent: OPENROUTER_API_KEY ayarlanmamış, mock moda geçiliyor.")

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
        p = Path(image_path)
        if not p.exists():
            parent = p.parent
            if not parent.exists():
                raise FileNotFoundError(
                    f"Üst dizin mevcut değil: {parent} — Docker volume mount sorunu olabilir. "
                    f"Beklenen dosya: {image_path}"
                )
            existing = list(parent.glob("*"))[:5]
            raise FileNotFoundError(
                f"Görüntü dosyası bulunamadı: {image_path} | "
                f"Dizin var ({parent}), içindeki ilk dosyalar: {[f.name for f in existing]}"
            )
        if not os.access(image_path, os.R_OK):
            raise PermissionError(
                f"Dosya var ama okunamıyor (yetki sorunu): {image_path}"
            )

        if self._client:
            return self._run_api(image_path)
        return self._run_mock(image_path)

    def _run_api(self, image_path: str) -> str:
        """OpenRouter API üzerinden gerçek analiz."""
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
    def _run_mock(image_path: str) -> str:
        """API key yokken otonom mock rapor üretir."""
        report = random.choice(_MOCK_REPORTS)
        log.info(f"DraftingAgent [MOCK]: {Path(image_path).name} için sahte rapor üretildi.")
        return _format_report(report)

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
