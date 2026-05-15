# VTO — Teknik Audit & Düzeltme Planı

**Tarih:** 2026-05-14  
**Kapsam:** Tüm codebase (Next.js web + Expo mobile) tam tarama  
**Amaç:** App Store'a çıkabilir, ücretli kullanıcı tutabilir hale getirmek

---

## İçindekiler

1. [Mevcut Durum Özeti](#1-mevcut-durum-özeti)
2. [Kritik Güvenlik Açığı — Auth Kapalı](#2-kritik-güvenlik-açığı--auth-kapalı)
3. [Hız Problemi — 20-60s → Hedef 10s](#3-hız-problemi--20-60s--hedef-10s)
4. [AI Stylist — Sahte Özellik (App Store Riski)](#4-ai-stylist--sahte-özellik-app-store-riski)
5. [Görüntü Sıkıştırma — Sessiz Hız Katili](#5-görüntü-sıkıştırma--sessiz-hız-katili)
6. [History Tab — URL Expiry Hatası](#6-history-tab--url-expiry-hatası)
7. [Freemium Model — Quota + RevenueCat](#7-freemium-model--quota--revenuecat)
8. [Polling → Webhook + Realtime Mimarisi](#8-polling--webhook--realtime-mimarisi)
9. [Öncelik Sırası ve Tahmini Süreler](#9-öncelik-sırası-ve-tahmini-süreler)

---

## 1. Mevcut Durum Özeti

### Stack

| Katman | Teknoloji |
|--------|-----------|
| Mobile | Expo 54, React Native 0.81, Expo Router |
| Web/Backend | Next.js 16.1.6, Vercel |
| Veritabanı | Supabase (Postgres, Auth, Storage, Realtime) |
| AI Modeli | Replicate — `cuuupid/idm-vton` |
| Build | EAS Build + EAS Submit |

### Uygulama Sekmeleri ve Gerçek Durumları

| Sekme | Ne Olduğu Düşünülüyor | Gerçek Durum |
|-------|----------------------|--------------|
| Home (Try-On) | AI ile kıyafet giydirme | Çalışıyor, ama yavaş ve auth açık |
| Closet (History) | Geçmiş try-onlar | Çalışıyor, ama Replicate URL'i expire oluyor |
| Analysis | AI beden tahmini | Çalışıyor — tamamen client-side matematik (BMI formülü) |
| Stylist | AI outfit önerileri | **SAHTE** — static hardcoded kart, 1.8s sahte loading |
| Profile | Kullanıcı profili | Çalışıyor |

---

## 2. Kritik Güvenlik Açığı — Auth Kapalı

### Problem

`src/app/api/generate/route.ts` satır 37-45 ve `src/app/api/predictions/[id]/route.ts` satır 16-23 içindeki authentication kodu yorum satırına alınmış ve production'da da bu şekilde:

```typescript
// TEMPORARILY DISABLED for mobile app development (since RN doesn't send cookies easily)
// const supabase = await createClient();
// const { data: { user } } = await supabase.auth.getUser();
// if (!user) { return NextResponse.json({ error: '...' }, { status: 401 }); }
```

Bu durumda:
- Endpoint URL'ini bulan herhangi biri sınırsız generate isteği gönderebilir
- Her istek Replicate hesabına ücret yazar
- Hiçbir per-user sınırı uygulanamaz
- Bot taraması durumunda dakikalar içinde hesap biter

### Neden Cookie Çalışmıyor

Supabase'in default istemci `createClient()` cookie'den session okur. React Native fetch, browser gibi otomatik cookie göndermez. Çözüm: cookie yerine `Authorization` header'ı kullanmak.

### Düzeltme — Mobil Uygulama (home.tsx)

`handleGenerate` içindeki fetch çağrısını güncelle:

```typescript
// home.tsx — handleGenerate fonksiyonu içinde, fetch'ten önce
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  Alert.alert('Session expired', 'Please sign in again.');
  return;
}

response = await fetch(`${BACKEND_URL}/api/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,  // ← ekle
  },
  signal: controller.signal,
  body: JSON.stringify({ ... }),
});
```

### Düzeltme — Backend (generate/route.ts ve predictions/[id]/route.ts)

Her iki route'ta da aynı pattern:

```typescript
// Mevcut yorum satırını sil, bunu ekle:
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

if (!token) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const supabase = await createClient();
const { data: { user }, error } = await supabase.auth.getUser(token);

if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Not:** `predictions/[id]/route.ts`'te status check için user kontrolü yeterli, user.id kullanmana gerek yok — sadece "bu istek authenticated mı" kontrolü yapılıyor.

---

## 3. Hız Problemi — 20-60s → Hedef 10s

### Problem Analizi

Mevcut pipeline:
```
Kullanıcı Generate'e basar
  → Büyük base64 fotoğraf upload (2-5 saniye)
  → Replicate'te IDM-VTON başlar (20-50 saniye, steps: 20)
  → Mobil her 3 saniyede polling atar
  → Tamamlandıktan sonra max 3 saniye ekstra bekler
  ──────────────────────────────────────────
  TOPLAM: 25-58 saniye
```

Darboğazlar sırasıyla:
1. IDM-VTON model inference süresi (en büyük)
2. Büyük görüntü upload süresi
3. 3 saniyelik polling gecikmesi

---

### Çözüm A — Steps Düşürme (En Kolay, 5 Dakika)

`src/app/api/generate/route.ts` satır 60:

```typescript
// Şu an:
steps: 20

// Değiştir:
steps: 10
```

**Etki:** Inference süresi yaklaşık yarıya iner (10-30 saniye). Kalite %10-15 düşer ama göze batan bir fark değil. App Store review için yeterli. Bu değişikliği hemen uygula, diğerleri bekleyebilir.

---

### Çözüm B — Model Değişikliği: Fashn.ai (Önerilen, 1 Gün)

Fashn.ai sanal giyim için özel optimize edilmiş bir API. IDM-VTON genel amaçlı bir diffusion modeli — Fashn.ai sadece bu iş için yazılmış. Sonuç: 6-12 saniye, IDM-VTON'dan daha iyi kalite.

Fiyat: $0.006-0.010/generation (Replicate'ten ucuz veya eşit).

Fashn.ai API dokümanı: https://fashn.ai/docs

**generate/route.ts'i tamamen yeniden yaz:**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  // Auth kontrolü (Bölüm 2'deki düzeltme uygulandıktan sonra)
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { baseImage, garments } = body;

  if (!baseImage || !garments?.[0]?.image) {
    return NextResponse.json({ error: 'baseImage and garment required' }, { status: 400 });
  }

  const response = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_image: baseImage,
      garment_image: garments[0].image,
      category: 'tops',      // 'tops' | 'bottoms' | 'one-pieces'
      mode: 'balanced',      // 'performance' daha hızlı, 'quality' daha iyi
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  const { id } = await response.json();
  return NextResponse.json({ success: true, data: { predictionId: id } });
}
```

**predictions/[id]/route.ts'i Fashn.ai status endpoint'ine çevir:**

```typescript
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Auth kontrolü...

  const { id } = await params;

  const response = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
    headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}` },
  });
  const data = await response.json();

  // Fashn.ai status: 'starting' | 'processing' | 'completed' | 'failed'
  const statusMap: Record<string, string> = {
    starting: 'starting',
    processing: 'processing',
    completed: 'succeeded',
    failed: 'failed',
  };

  return NextResponse.json({
    success: true,
    status: statusMap[data.status] ?? data.status,
    data: {
      generatedImage: data.output?.[0] ?? null,
    },
  });
}
```

**Ortam değişkeni:**

```
# .env.local ve Vercel dashboard'a ekle
FASHN_API_KEY=fashn_xxx
```

---

### Çözüm C — Alternatif Replicate Modeli: CatVTON

Fashn.ai entegre etmek istemiyorsan, Replicate'te kal ama modeli değiştir. `zhengchong/catvton` IDM-VTON'dan 2-3x hızlı:

```typescript
// generate/route.ts — replicate.predictions.create içinde
const prediction = await replicate.predictions.create({
  version: "catvton-model-version-hash",  // Replicate'ten al
  input: {
    person_image: baseImage,
    cloth_image: garments[0].image,
    num_inference_steps: 20,  // bu model için 20 step ≈ IDM-VTON 10 step kalitesi
  }
});
```

**Tavsiye:** Önce CatVTON'u dene, kalite yeterliyse Fashn.ai entegrasyonuna gerek kalmayabilir.

---

## 4. AI Stylist — Sahte Özellik (App Store Riski)

### Problem

`ai-vto-mobile/app/(tabs)/stylist.tsx` satır 73-79:

```typescript
const handleGetSuggestions = () => {
  if (!garmentImage) return;
  setIsLoading(true);
  setShowResults(false);
  setTimeout(() => {
    setIsLoading(false);
    setShowResults(true);    // ← 3 hardcoded kartı göster
  }, 1800);                  // ← sahte 1.8 saniye bekleme
};
```

`OUTFIT_SETS` array'i (satır 22-52) statik 3 kart içeriyor: "Casual Day Out", "Smart Office Look", "Night Out". Kullanıcının yüklediği garment fotoğrafı hiçbir şekilde işlenmiyor — hangi fotoğrafı yüklersen yükle aynı 3 kart çıkıyor.

App Store Connect metadata'sında şunlar yazıyor:
- _"AI Stylist: chat-based style recommendations tailored to you"_

Apple reviewer farklı garmentler yükleyip hep aynı sonucu görürse bu misleading content gerekçesiyle reddeder. Bu özelliği gerçek hale getirmeden App Store'a gönderme.

### Çözüm — Gerçek Vision API Entegrasyonu

**Adım 1: Backend endpoint ekle (`src/app/api/stylist/route.ts`)**

```typescript
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  // Auth kontrolü (Bölüm 2 ile aynı pattern)
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { garmentImage } = await req.json();
  // garmentImage: "data:image/jpeg;base64,..."

  const client = new Anthropic();

  const base64Data = garmentImage.replace(/^data:image\/\w+;base64,/, '');
  const mediaType = 'image/jpeg';

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',  // Haiku: hızlı ve ucuz, vision destekli
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data },
          },
          {
            type: 'text',
            text: `Analyze this garment image and provide exactly 3 outfit suggestions.

For each suggestion return JSON in this exact format:
{
  "outfits": [
    {
      "title": "Outfit name (e.g. Casual Day Out)",
      "emoji": "one emoji",
      "occasion": "When to wear it",
      "wearWith": ["item 1", "item 2"],
      "accessories": ["accessory 1", "accessory 2"],
      "shoes": "shoe suggestion",
      "tip": "one practical styling tip"
    }
  ]
}

Base your suggestions on the actual color, style, and type of this specific garment. Return only valid JSON, no other text.`,
          },
        ],
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({ success: true, outfits: parsed.outfits });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to parse suggestions' }, { status: 500 });
  }
}
```

**Ortam değişkeni:**

```
ANTHROPIC_API_KEY=sk-ant-xxx
```

**Adım 2: stylist.tsx'i güncelle**

```typescript
// OutfitCard interface'ini genişlet
interface OutfitCard {
  title: string;
  emoji: string;
  occasion: string;
  wearWith: string[];       // 'items' → 'wearWith'
  accessories: string[];
  shoes: string;
  tip: string;
}

// State'e outfits ekle
const [outfits, setOutfits] = useState<OutfitCard[]>([]);

// handleGetSuggestions'ı gerçek API çağrısıyla değiştir
const handleGetSuggestions = async () => {
  if (!garmentImage) return;
  setIsLoading(true);
  setShowResults(false);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const base64 = await FileSystem.readAsStringAsync(garmentImage, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const res = await fetch(`${BACKEND_URL}/api/stylist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ garmentImage: `data:image/jpeg;base64,${base64}` }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    setOutfits(data.outfits);
    setShowResults(true);
  } catch (err: any) {
    Alert.alert('Error', 'Could not get suggestions. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

Render kısmında `OUTFIT_SETS` yerine `outfits` state'ini kullan. `wearWith` field ismi değişti, `items` → `wearWith` olarak güncelle.

**Maliyet:** Claude Haiku ~$0.0003/istek. Pratik olarak bedava.

---

## 5. Görüntü Sıkıştırma — Sessiz Hız Katili

### Problem

`home.tsx:105` — garment pick: `quality: 0.5`  
`home.tsx:76` — kamera: `quality: 0.8`  
`home.tsx:125` — person photo: `readPhotoAsBase64()` orijinal boyutuyla okunuyor

iPhone 15 Pro'da `quality: 0.8` ile çekilen fotoğraf 3-5 MB. Base64 encoding %33 şişirir → 4-7 MB JSON body. 4G bağlantıda bu 2-4 saniye upload süresi demek. Bu süre model inference süresine ekleniyor.

### Düzeltme

```bash
npx expo install expo-image-manipulator
```

`home.tsx`'te bir yardımcı fonksiyon ekle:

```typescript
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Dosyanın üst kısmında, component'ten önce
async function compressToBase64(uri: string, maxWidth = 768): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.75, format: SaveFormat.JPEG, base64: true }
  );
  return result.base64!;
}
```

`handleGenerate` içinde kullan:

```typescript
// Şu an (satır 125):
const personBase64 = await readPhotoAsBase64(selectedPhoto.uri);

// Değiştir:
const personBase64 = await compressToBase64(selectedPhoto.uri);

// Garment için de (garmentBase64 zaten var ama yüksek kalitede):
// pickGarment'ta base64: true ile ImagePicker kullanıyorsun
// Onu da compress et:
const compressedGarment = await compressToBase64(garmentUri!);
// garmentBase64 state'i yerine bunu kullan
```

**Etki:** Upload süresi %60-70 azalır. 4 MB → 1.2 MB.

---

## 6. History Tab — URL Expiry Hatası

### Problem

`home.tsx:171` içinde background save:

```typescript
const supabaseUrl = await uploadTryOnImage(replicateUrl, user.id);
await supabase.from('generations').insert({
  generated_image_url: supabaseUrl,   // ← bu doğru
  ...
});
```

Mantık doğru — Supabase Storage URL'i kaydediliyor. Ama buradaki tehlike: eğer `uploadTryOnImage` herhangi bir sebepten başarısız olursa (network, Supabase quota, vs.) ve hata sessizce yutulursa, Replicate URL'i `generations` tablosuna kaydedilmiş olabilir. Replicate URL'leri ~1 saat sonra expire oluyor.

### Düzeltme

`home.tsx`'te storage.ts'nin `uploadTryOnImage` fonksiyonunu kontrol et. Eğer fail ederse Replicate URL'i direkt kaydetme — ya retry yap ya da o generate'i tabloya hiç ekleme.

```typescript
// home.tsx background save içinde
try {
  const supabaseUrl = await uploadTryOnImage(replicateUrl, user.id);
  // Sadece Supabase URL başarılıysa kaydet
  await supabase.from('generations').insert({
    user_id: user.id,
    base_image_url: 'saved_on_device',
    garment_image_url: 'data_uri_omitted',
    garment_title: 'Mobile Upload',
    generated_image_url: supabaseUrl,  // ← her zaman Supabase URL
  });
} catch {
  // Supabase upload başarısız → tabloya ekleme
  // Result ekranda görünmeye devam eder, sadece history'e girmez
}
```

---

## 7. Freemium Model — Quota + RevenueCat

### Veritabanı Değişiklikleri

`supabase_schema.sql`'e ekle (Supabase dashboard > SQL Editor):

```sql
-- Profiles tablosuna premium ve quota kolonları
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_generations INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_reset_at DATE DEFAULT CURRENT_DATE;

-- Atomic quota kontrolü ve artırımı
CREATE OR REPLACE FUNCTION public.check_and_increment_generation(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile    profiles%ROWTYPE;
  FREE_LIMIT   CONSTANT int := 3;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;

  -- Günlük reset (UTC'ye göre)
  IF v_profile.daily_reset_at < CURRENT_DATE THEN
    UPDATE profiles
    SET daily_generations = 0, daily_reset_at = CURRENT_DATE
    WHERE id = p_user_id;
    v_profile.daily_generations := 0;
  END IF;

  -- Premium veya limit altında → geçir ve artır
  IF v_profile.is_premium OR v_profile.daily_generations < FREE_LIMIT THEN
    UPDATE profiles
    SET daily_generations = daily_generations + 1
    WHERE id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
```

### Backend — Quota Kontrolü (generate/route.ts)

Auth kontrolünden sonra, Replicate/Fashn çağrısından önce:

```typescript
// Quota kontrol
const { data: allowed, error: quotaError } = await supabase.rpc(
  'check_and_increment_generation',
  { p_user_id: user.id }
);

if (quotaError || !allowed) {
  return NextResponse.json(
    {
      success: false,
      error: 'daily_limit_reached',
      message: 'You have used your 3 free generations today. Upgrade to Premium for unlimited access.',
    },
    { status: 429 }
  );
}
```

### Mobil — Paywall (home.tsx)

```typescript
// handleGenerate içinde, data.success kontrolünden sonra:
if (!data.success) {
  if (data.error === 'daily_limit_reached') {
    setShowPaywall(true);  // ← paywall modal aç
    return;
  }
  throw new Error(data.error ?? 'Backend returned an error');
}
```

Paywall modal state'i ve JSX'i ekle — basit bir "Upgrade to Premium" sheet.

### RevenueCat Entegrasyonu

```bash
npx expo install react-native-purchases
```

```typescript
// app/_layout.tsx içinde, uygulama başlarken
import Purchases from 'react-native-purchases';

useEffect(() => {
  Purchases.configure({ apiKey: 'appl_xxxxx' });  // RevenueCat iOS key
}, []);
```

```typescript
// Satın alma fonksiyonu (paywall modal içinde)
const handleUpgrade = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    const monthly = offerings.current?.availablePackages.find(
      p => p.packageType === 'MONTHLY'
    );
    if (!monthly) return;

    const { customerInfo } = await Purchases.purchasePackage(monthly);
    const isPremium = !!customerInfo.entitlements.active['premium'];

    if (isPremium) {
      // Supabase'e yansıt
      await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
      setShowPaywall(false);
      Alert.alert('Welcome to Premium!', 'Unlimited generations activated.');
    }
  } catch (err: any) {
    if (!err.userCancelled) Alert.alert('Error', 'Purchase failed. Please try again.');
  }
};
```

**RevenueCat Dashboard'da:**
- Product ID: `vto_premium_monthly`
- Fiyat: $4.99/ay veya $34.99/yıl
- Entitlement: `premium`

App Store Connect'te abonelik ürünü oluştururken "subscription group" gerekiyor — bir kere yapınca değişmez.

---

## 8. Polling → Webhook + Realtime Mimarisi

### Mevcut Problem

```
home.tsx:150-194: 80 denemede, 3 saniyede bir polling
→ Her poll: mobile → Vercel → Replicate API → mobile
→ Tamamlandıktan sonra max 3 saniye ekstra
→ 80 × 3 = 4 dakikaya kadar polling (gereksiz)
```

### Hedef Mimari

```
Generate isteği → Replicate/Fashn başlar
                         ↓
              (generation süresi — ~6-25s)
                         ↓
         Replicate webhook → /api/webhook/replicate
                         ↓
              Supabase generations tablosuna yaz
                         ↓
         Supabase Realtime broadcast (channel: user_id)
                         ↓
              Mobil app anında gösterir (0-500ms gecikme)
```

### Backend — Webhook Endpoint (src/app/api/webhook/replicate/route.ts)

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  // Replicate webhook imza doğrulaması
  const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET!;
  const signature = req.headers.get('webhook-secret');
  if (signature !== webhookSecret) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = await req.json();
  const { id: predictionId, status, output, urls } = body;

  if (status !== 'succeeded' || !output) {
    return NextResponse.json({ received: true });
  }

  const imageUrl = Array.isArray(output) ? output[0] : output;

  // Prediction ID'den user_id'yi bul (pending_generations tablosundan)
  const supabase = await createClient();
  const { data: pending } = await supabase
    .from('pending_generations')
    .select('user_id')
    .eq('prediction_id', predictionId)
    .single();

  if (!pending) return NextResponse.json({ received: true });

  // Supabase Storage'a yükle
  const storageUrl = await uploadFromUrl(imageUrl, pending.user_id);

  // Generations tablosuna kaydet
  await supabase.from('generations').insert({
    user_id: pending.user_id,
    generated_image_url: storageUrl,
    garment_title: 'Mobile Upload',
    base_image_url: 'saved_on_device',
    garment_image_url: 'data_uri_omitted',
  });

  // Realtime broadcast
  await supabase.channel(`generation:${pending.user_id}`).send({
    type: 'broadcast',
    event: 'completed',
    payload: { predictionId, imageUrl: storageUrl },
  });

  // Pending'i temizle
  await supabase.from('pending_generations').delete().eq('prediction_id', predictionId);

  return NextResponse.json({ received: true });
}
```

**Yeni tablo — pending_generations:**

```sql
CREATE TABLE IF NOT EXISTS public.pending_generations (
  prediction_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pending_generations ENABLE ROW LEVEL SECURITY;
-- Service role'den erişilecek, normal kullanıcıdan değil
```

### Mobil — Polling Yerine Realtime

`home.tsx:150-194` arasındaki polling loop'u sil. Yerine:

```typescript
// handleGenerate içinde, predictionId alındıktan sonra:
const { data: { session } } = await supabase.auth.getSession();

const channel = supabase
  .channel(`generation:${session?.user.id}`)
  .on('broadcast', { event: 'completed' }, ({ payload }) => {
    if (payload.predictionId === predictionId) {
      setResultImage(payload.imageUrl);
      setIsGenerating(false);
      setLoadingStep('');
      channel.unsubscribe();
    }
  })
  .subscribe();

// Timeout — 3 dakika sonra hâlâ gelmezse:
const timeout = setTimeout(() => {
  channel.unsubscribe();
  setIsGenerating(false);
  Alert.alert('Timeout', 'Generation took too long. Please try again.');
}, 180_000);

// Component unmount'ta cleanup
return () => {
  clearTimeout(timeout);
  channel.unsubscribe();
};
```

**Not:** Bu mimari Fashn.ai için de çalışır. Fashn.ai de webhook destekliyor. Webhook URL'ini Fashn.ai request body'sine ekle:

```typescript
body: JSON.stringify({
  model_image: baseImage,
  garment_image: garments[0].image,
  category: 'tops',
  webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/fashn`,
}),
```

---

## 9. Öncelik Sırası ve Tahmini Süreler

### App Store'a Göndermeden Önce Zorunlu

| # | Görev | Dosyalar | Tahmini Süre |
|---|-------|----------|--------------|
| 1 | Auth'u aç (Bearer token) | `generate/route.ts`, `predictions/[id]/route.ts`, `home.tsx` | 2 saat |
| 2 | Stylist'i gerçek API'ye bağla | `stylist.tsx`, yeni `api/stylist/route.ts` | 4 saat |
| 3 | Image compression ekle | `home.tsx` | 1 saat |
| 4 | `steps: 20 → 10` | `generate/route.ts` satır 60 | 5 dakika |
| 5 | History URL expiry düzelt | `home.tsx` satır 166-183 | 1 saat |

**Toplam: ~1 iş günü.** Bu 5 adım tamamlandıktan sonra App Store'a gönderilebilir.

---

### İkinci Sprint (Sonrası)

| # | Görev | Dosyalar | Tahmini Süre |
|---|-------|----------|--------------|
| 6 | Fashn.ai model geçişi | `generate/route.ts`, `predictions/[id]/route.ts` | 1 gün |
| 7 | Freemium quota sistemi | `supabase_schema.sql`, `generate/route.ts`, `home.tsx` | 1 gün |
| 8 | RevenueCat entegrasyonu | `app/_layout.tsx`, `home.tsx`, yeni paywall component | 1 gün |
| 9 | Webhook + Realtime mimarisi | yeni `api/webhook/` routes, `home.tsx` | 1-2 gün |

---

## Ekler

### Gerekli Ortam Değişkenleri (Güncel Tam Liste)

**Vercel Dashboard ve .env.local:**

```
# Mevcut
REPLICATE_API_TOKEN=r8_xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Eklenecek
FASHN_API_KEY=fashn_xxx                    # Model geçişi sonrası
ANTHROPIC_API_KEY=sk-ant-xxx               # Stylist için
REPLICATE_WEBHOOK_SECRET=whsec_xxx         # Webhook mimarisi sonrası
NEXT_PUBLIC_APP_URL=https://virtual-try-on-three-sage.vercel.app
```

**Expo (ai-vto-mobile .env veya app.config):**

```
EXPO_PUBLIC_BACKEND_URL=https://virtual-try-on-three-sage.vercel.app
```

---

### Hız İyileştirmesi Özet Tablosu

| Değişiklik | Beklenen Kazanım | Zorluk |
|------------|-----------------|--------|
| `steps: 20 → 10` | ~10s azalma | Çok Kolay |
| Image compression | 2-4s azalma | Kolay |
| Fashn.ai geçişi | 10-40s azalma | Orta |
| Webhook (polling kaldır) | ~1.5s algısal kazanım | Zor |
| **Toplam (hepsi)** | **~25-55s azalma** | |

---

*Bu doküman 2026-05-14 tarihinde tam codebase taramasıyla hazırlanmıştır. Satır numaraları o tarihteki dosya durumunu yansıtır.*
