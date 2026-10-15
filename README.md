# Buxoro SSB 360

Buxoro viloyati sog‘liqni saqlash boshqarmasi uchun xarita asosidagi **Muassasa 360°** va rahbariyat uchun **3D Situatsion markaz** nazorat tizimi.

## Asosiy oqimlar

Operator/admin ish jarayoni:

`Buxoro xaritasi → hudud → muassasa → Muassasa 360° → nazorat modullari`

Rahbar/TV ish jarayoni:

`3D Situatsion markaz → Buxoro xaritasi → risk / alert / resurslar → hudud yoki muassasa → Muassasa 360°`

Tizim rahbar uchun muassasa pasporti, kadrlar, aholi va bemorlar, qabullar, kasalliklar, statsionar, tez yordam, onalik va bolalik, skrining, laboratoriya, diagnostika, dori, uskunalar, AKT, DMED, moliya, pullik xizmatlar, xaridlar, infratuzilma, transport, murojaatlar, QR, ijro, KPI, sifat, infeksiya nazorati, o‘lim holatlari, telemeditsina, yig‘ilish intizomi va xavf signallarini yagona oynada ko‘rsatish uchun qurilgan.

## 3D Situatsion markaz

Himoyalangan sahifa: `GET /situation-center`

- MapLibre GL JS `6.14.0` brauzer runtime fayllari CDN orqali emas, ilovaning o‘zidan self-host qilinadi.
- Mavjud Leaflet operator xaritasi saqlanadi; 3D rejim alohida executive surface hisoblanadi.
- Markaziy xaritada muassasalar faqat foydalanuvchi vakolati doirasida ko‘rsatiladi.
- Risk holati mavjud bo‘lsa marker `red / amber / green`; risk ma’lumoti yetarli bo‘lmasa marker neutral rangda qoladi.
- Aniq GPS tasdiqlanmagan koordinata `district-center`, `city-center` yoki `unknown` sifatida ochiq ko‘rsatiladi.
- Chap panellarda resurslar va TOP reyting, o‘ng panellarda alertlar, joriy faoliyat/data health va trendlar ko‘rsatiladi.
- Fullscreen va 20 soniyalik read-only taqdimot rejimi mavjud; foydalanuvchi sichqoncha yoki klaviatura bilan aralashsa taqdimot to‘xtaydi.
- WebGL yoki MapLibre ishga tushmasa, rahbar panellari saqlanib qoladi va ro‘yxat/navigatsiya fallback ishlaydi.
- `360° ochish` mavjud Muassasa 360° drawer’iga `/?institution=<id>` deep-link orqali o‘tadi; 360° modul takroran yozilmaydi.

### Xarita manbasi

Default holatda lokal MapLibre style konfiguratsiyasi OpenStreetMap-compatible raster tile qatlamidan foydalanadi.

Ixtiyoriy vector/3D style faqat server tomonidan tasdiqlanganda ishlaydi:

```env
SITUATION_MAP_STYLE_URL=
SITUATION_MAP_STYLE_ALLOWED_HOSTS=
```

`SITUATION_MAP_STYLE_URL` HTTPS bo‘lishi va hostname `SITUATION_MAP_STYLE_ALLOWED_HOSTS` ro‘yxatida bo‘lishi kerak. Aks holda tizim fail-closed qiladi va default raster rejimiga qaytadi. Mos building geometry mavjud bo‘lmasa tizim sun’iy 3D bino yaratmaydi.

## Data siyosati

- Ulanmagan ma’lumot **0** bilan to‘ldirilmaydi; `N/A` bo‘lib qoladi.
- Qo‘lda kiritilgan qiymatlar `manual` manba sifatida saqlanadi.
- Jonli integratsiya qiymati manba va vaqt metama’lumoti bilan kelishi kerak.
- Risk ma’lumoti yo‘q muassasa avtomatik ravishda yashil deb belgilanmaydi.
- Reyting faqat mavjud haqiqiy qiymatlar asosida tuziladi; missing qiymat `0`ga aylantirilmaydi.
- Muassasa uchun aniq GPS koordinatasi tasdiqlanmagan bo‘lsa, marker hudud/shahar markazi bo‘yicha ko‘rsatiladi va UI buni ochiq bildiradi.
- DMED/OneID foydalanuvchi paroli, JShShIR yoki pasport ma’lumoti ushbu ilovada saqlanmaydi.

## Texnik arxitektura

- Node.js 22 + Express 5 + TypeScript 5.9
- PostgreSQL — system of record
- Redis — xavfsizlik/cache qatlami
- Leaflet + OpenStreetMap — operator xaritasi
- MapLibre GL JS `6.14.0` — 3D Situatsion markaz
- HttpOnly/SameSite session cookie
- RBAC va district/institution scope enforcement
- CSP, same-origin/CSRF va boshqa security headerlar
- Docker build ichida testlar majburiy: test muvaffaqiyatsiz bo‘lsa production image yaratilmaydi
- Railway production readiness healthcheck: `/api/ready`

## API

Asosiy API:

- `GET /api/health`
- `GET /api/ready`
- `GET /api/bootstrap`
- `GET /api/institutions`
- `GET /api/institutions/:id/summary`
- `GET /api/modules/:institutionId`
- `POST /api/admin/metrics`
- `GET /api/integrations`

3D Situatsion markaz API:

- `GET /api/v1/situation-center/bootstrap`
- `GET /api/v1/situation-center/districts/:districtKey`
- `GET /api/v1/situation-center/institutions/:institutionId`
- `GET /api/v1/situation-center/trends`

Barcha Situation Center endpointlari autentifikatsiya va mavjud foydalanuvchi scope qoidalariga bo‘ysunadi.

## Lokal ishga tushirish

```bash
npm install
npm test
npm run build
npm run dev
```

Production Railway orqali `main` branchdan deploy qilinadi. Pull request merge qilinishidan oldin GitHub Actions `Test`, `TypeScript build` va `Dependency security audit` bosqichlari green bo‘lishi kerak.
