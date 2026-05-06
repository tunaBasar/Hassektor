1. Aşama
Sen uzman bir Frontend mimarısın. React 19, Vite ve Tailwind CSS kullanarak tıbbi bir radyoloji asistanı (MediCopilot) için arayüz geliştireceğiz. 

Öncelikle şu altyapıyı kur:
1. Vite ile React-TS projesini başlat.
2. Tailwind CSS'i kur ve yapılandır.
3. Shadcn UI'ı projeye entegre et. Kesinlikle 'Dark' tema ve 'Slate' renk paletini varsayılan olarak ayarla. 
4. İhtiyacımız olacak şu Shadcn bileşenlerini kur: Button, Card, Toast, Input.

Altyapı bitince ilk sayfamız olan "Yükleme Ekranı"nı (Upload View) tasarla:
- Arka plan koyu füme/siyah tonlarında olacak, göz yormayacak.
- Ekranın tam ortasında geniş, minimal ve şık bir "Drag & Drop" (Sürükle-Bırak) alanı olacak.
- Bu alan sadece ".jpg", ".jpeg" ve ".png" formatındaki dosyaları kabul edecek.
- Dosya seçildiğinde ekranda dosyanın adını gösteren ufak bir Card belirecek ve altında "Analize Gönder" butonu çıkacak. 
- Şimdilik backend'e bağlama, sadece UI ve form validasyonunu (dosya tipi kontrolü) kusursuz çalışır hale getir.

2. Aşama
Sen uzman bir UI/UX Frontend geliştiricisisin. Bir önceki yükleme ekranından "Analize Gönder" butonuna basıldığında açılacak olan "Doktor İnceleme Ekranı"nı (Dashboard View) tasarla. Animasyonlar için 'framer-motion' kütüphanesini projeye dahil et (npm install framer-motion).

Şu mimariyi ve etkileşimleri eksiksiz kur:

1. Ekran Bölünmesi (Split Layout):
- Ekranı yatayda asimetrik olarak ikiye böl: Sol taraf %60, Sağ taraf %40 genişliğinde olsun.
- Tasarım kesinlikle karanlık (dark) tema kalsın, grid yapısı ve kenarlıklar net, temiz ve profesyonel görünsün.

2. Sol Panel (MR Görüntüleyicisi ve AI Görüşü):
- Yüklenen sahte MR görüntüsünü bu alana ortala.
- Tarama Animasyonu: Sayfa açıldığında resmin üzerinden yukarıdan aşağıya doğru inen ince, parlak (neon mavi veya yeşil) bir "tarama çizgisi" geçsin (framer-motion ile).
- Anomali Vurgusu: Tarama çizgisi aşağıya ulaştığında, resmin rastgele bir bölgesinde ince, kırmızı/turuncu renkli, yavaşça yanıp sönen (breathing/pulsing opacity) bir çerçeve (Bounding Box) belirtsin.

3. Sağ Panel (AI Taslak Rapor Editörü):
- Üstte "Yapay Zeka Taslak Raporu" başlığı olsun.
- Sol taraftaki tarama animasyonu bittiği an, sağ taraftaki metin kutusuna mock bir tıbbi rapor dolmaya başlasın. 
- Daktilo (Typewriter) Efekti: Bu mock rapor ekrana birden düşmesin. Bir LLM gibi harf harf/kelime kelime yazılsın. Metin içindeki "Lezyon", "Anomali", "3mm" gibi kısımlar otomatik olarak kalın (bold) gözüksün.
- Bu raporun yazıldığı alan, standart bir div değil, doktorun müdahale edebileceği şık bir "Textarea" (veya Shadcn metin editörü) olsun.

4. Yasal Onay Butonu:
- Sağ panelin en altında büyük bir buton olacak.
- Bu buton, daktilo efektiyle raporun yazılması bitene kadar 'disabled' (etkisiz) kalsın.
- Rapor yazımı bitince buton aktifleşsin ve üzerinde "İnceledim ve Onaylıyorum" yazsın.

Şimdilik backend ve WebSocket bağlama. Sadece bu sahte akışın, animasyonların ve UI'ın pürüzsüz çalışmasını sağla.

3. Aşama 
Sen uzman bir Frontend Mimarı ve Entegrasyon Uzmanısın. Faz 1 ve Faz 2'de hazırladığımız UI bileşenlerini ve animasyonları şimdi Java Spring Boot backend'ine bağlayacağız. API çağrıları için 'axios' ve WebSocket için '@stomp/stompjs' ile 'sockjs-client' kütüphanelerini projeye dahil et.

Şu entegrasyonları eksiksiz kur:

1. Yükleme Ekranı (POST İsteği):
- Yükleme Ekranındaki "Analize Gönder" butonuna tıklandığında, seçilen dosyayı FormData'ya çevir ve `POST http://localhost:8080/api/v1/mri/upload` uç noktasına gönder.
- İstek başarılı olursa, dönen yanıtı (veya report_id'yi) state'e al ve kullanıcıyı "Doktor İnceleme Ekranı"na (Dashboard) yönlendir. Hata alırsan kırmızı bir Shadcn Toast çıkar.

2. Gerçek Zamanlı Dinleme (WebSocket):
- Doktor İnceleme Ekranı (Dashboard) açıldığı anda (useEffect içinde) Java'nın WebSocket kanalına bağlan: `ws://localhost:8080/ws/notifications`
- Kanaldan şu formatta bir mesaj bekle: `{ "report_id": "123", "status": "READY", "ai_draft_text": "..." }`

3. UI ve Animasyonların Tetiklenmesi:
- WebSocket'ten "READY" mesajı geldiği an ekranın sağ altından yeşil bir Shadcn Toast ("Yapay Zeka Raporu Hazır!") çıkart.
- Faz 2'de yaptığın Tarama (Scanner) animasyonunu bitir, "ai_draft_text" alanından gelen gerçek metni sağ paneldeki editöre Daktilo (Typewriter) efektiyle yazdırmaya başla.

4. Onay Mekanizması (PUT İsteği):
- Doktor metin üzerinde değişiklik yapıp sağ alttaki "İnceledim ve Onaylıyorum" butonuna bastığında, güncel metni al.
- Bunu `PUT http://localhost:8080/api/v1/reports/{report_id}` uç noktasına gönder. 
- İşlem başarılı olursa sistemi sıfırla veya "Rapor Kaydedildi" diyerek ana sayfaya yönlendir.

Geliştirme ortamında (Vite) çıkabilecek CORS hatalarını önlemek için `vite.config.ts` dosyasına proxy ayarlarını eklemeyi unutma. Kodların hatasız çalışmasını ve component'lerin temiz bir state yönetimi (Zustand veya Context API) ile konuşmasını sağla.

--------------------------------------------------------------------------------------------------------------------------------
 En son mock verilerini sil.