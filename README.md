# Buxoro SSB 360

Buxoro viloyati sog‘liqni saqlash boshqarmasi uchun xarita asosidagi **Muassasa 360°** nazorat tizimi.

## Asosiy oqim

`Buxoro xaritasi → hudud → muassasa → Muassasa 360° → nazorat modullari`

Tizim rahbar uchun muassasa pasporti, kadrlar, aholi va bemorlar, qabullar, kasalliklar, statsionar, tez yordam, onalik va bolalik, skrining, laboratoriya, diagnostika, dori, uskunalar, AKT, DMED, moliya, pullik xizmatlar, xaridlar, infratuzilma, transport, murojaatlar, QR, ijro, KPI, sifat, infeksiya nazorati, o‘lim holatlari, telemeditsina, yig‘ilish intizomi va xavf signallarini yagona oynada ko‘rsatish uchun qurilgan.

## Data siyosati

- Ulanmagan ma’lumot **0** bilan to‘ldirilmaydi; `N/A` bo‘lib qoladi.
- Qo‘lda kiritilgan qiymatlar `manual` manba sifatida saqlanadi.
- Jonli integratsiya qiymati manba va vaqt metama’lumoti bilan kelishi kerak.
- Muassasa uchun aniq GPS koordinatasi tasdiqlanmagan bo‘lsa, marker hudud/shahar markazi bo‘yicha ko‘rsatiladi va UI buni ochiq bildiradi.
- DMED/OneID foydalanuvchi paroli, JShShIR yoki pasport ma’lumoti ushbu ilovada saqlanmaydi.

## Texnik arxitektura

- Node.js 22 + Express 5 + TypeScript
- PostgreSQL
- Leaflet + OpenStreetMap
- HttpOnly/SameSite session cookie
- CSP va bazaviy security headerlar
- Docker build ichida testlar majburiy: test muvaffaqiyatsiz bo‘lsa production image yaratilmaydi
- Railway production healthcheck: `/api/health`

## API

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/institutions`
- `GET /api/institutions/:id/summary`
- `GET /api/modules/:institutionId`
- `POST /api/admin/metrics`
- `GET /api/integrations`

## Lokal ishga tushirish

```bash
npm install
npm test
npm run build
npm run dev
```

Production Railway orqali `main` branchdan deploy qilinadi.
