"""
test_agents.py — MediCopilot AI Worker Manuel Test Betiği

Kafka ve MongoDB'ye ihtiyaç duymadan agent pipeline'ını doğrudan test eder.
Kullanım: python test_agents.py
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Test edilecek görüntü yolu (Kaggle veri seti)
TEST_IMAGE = os.path.join(
    os.path.dirname(__file__),
    "data", "archive", "Testing", "glioma", "Te-gl_1.jpg",
)


def test_drafting_agent(image_path: str) -> str | None:
    """DraftingAgent'ı çalıştırır, üretilen raporu döndürür."""
    print("\n" + "=" * 60)
    print("ADIM 1: Drafting Agent — MRI Görüntü Analizi")
    print("=" * 60)
    print(f"Görüntü: {image_path}\n")

    try:
        from agents import DraftingAgent

        agent = DraftingAgent()
        draft = agent.run(image_path)

        print("✓ Taslak rapor başarıyla üretildi:\n")
        print(draft)
        return draft

    except FileNotFoundError as exc:
        print(f"✗ HATA: Görüntü dosyası bulunamadı → {exc}")
        print("  data/archive/Testing/glioma/ klasörünü kontrol edin.")
        return None
    except RuntimeError as exc:
        print(f"✗ HATA: API çağrısı başarısız → {exc}")
        print("  .env dosyasında OPENROUTER_API_KEY değerini kontrol edin.")
        return None
    except Exception as exc:
        print(f"✗ Beklenmeyen hata: {exc}")
        return None


def test_safety_agent(draft_text: str) -> dict | None:
    """SafetyAgent'ı çalıştırır, denetim sonucunu döndürür."""
    print("\n" + "=" * 60)
    print("ADIM 2: Safety Agent — Güvenlik Denetimi")
    print("=" * 60)

    try:
        from agents import SafetyAgent

        agent = SafetyAgent()
        result = agent.check(draft_text)

        is_safe = result.get("is_safe", False)
        confidence = result.get("confidence", 0.0)
        warnings = result.get("warnings", [])

        status = "GÜVENLİ ✓" if is_safe else "GÜVENSİZ ✗"
        print(f"Sonuç      : {status}")
        print(f"Güven Skoru: {confidence:.2f}")

        if warnings:
            print("Uyarılar   :")
            for w in warnings:
                print(f"  - {w}")
        else:
            print("Uyarılar   : Yok")

        return result

    except RuntimeError as exc:
        print(f"✗ HATA: API çağrısı başarısız → {exc}")
        print("  .env dosyasında OPENROUTER_API_KEY değerini kontrol edin.")
        return None
    except Exception as exc:
        print(f"✗ Beklenmeyen hata: {exc}")
        return None


def main():
    print("\nMediCopilot AI Worker — Agent Pipeline Testi")
    print("Tarih:", __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    # API key kontrolü
    if not os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENROUTER_API_KEY") == "your_key_here":
        print("\n✗ HATA: OPENROUTER_API_KEY .env dosyasında tanımlı değil.")
        print("  .env dosyasına geçerli bir key ekleyin ve tekrar çalıştırın.")
        sys.exit(1)

    # Adım 1: Drafting Agent
    draft = test_drafting_agent(TEST_IMAGE)
    if draft is None:
        print("\n✗ Drafting Agent başarısız oldu, test durduruluyor.")
        sys.exit(1)

    # Adım 2: Safety Agent
    result = test_safety_agent(draft)
    if result is None:
        print("\n✗ Safety Agent başarısız oldu.")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("TEST TAMAMLANDI — Her iki agent başarıyla çalıştı.")
    print("=" * 60)


if __name__ == "__main__":
    main()
