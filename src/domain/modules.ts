import type { Institution, InstitutionMetric } from './institution.js';

export type SourceStatus = 'live' | 'manual' | 'imported' | 'unavailable' | 'error';

export type ModuleMetric = {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string | null;
  sourceStatus: SourceStatus;
  sourceName?: string | null;
  fetchedAt?: string | null;
};

export type InstitutionModulePayload = {
  key: ModuleKey;
  label: string;
  category: string;
  status: SourceStatus;
  metrics: ModuleMetric[];
};

export const moduleDefinitions = [
  { key: 'passport', label: 'Muassasa pasporti', category: 'Boshqaruv' },
  { key: 'staff', label: 'Kadrlar', category: 'Boshqaruv' },
  { key: 'patients', label: 'Aholi va bemorlar', category: 'Tibbiy faoliyat' },
  { key: 'admissions', label: 'Qabullar', category: 'Tibbiy faoliyat' },
  { key: 'diseases', label: 'Kasalliklar', category: 'Tibbiy faoliyat' },
  { key: 'inpatient', label: 'Statsionar', category: 'Tibbiy faoliyat' },
  { key: 'emergency', label: 'Tez yordam / shoshilinch', category: 'Tibbiy faoliyat' },
  { key: 'maternalChild', label: 'Onalik va bolalik', category: 'Tibbiy faoliyat' },
  { key: 'screening', label: 'Skrining va profilaktika', category: 'Tibbiy faoliyat' },
  { key: 'laboratory', label: 'Laboratoriya', category: 'Diagnostika' },
  { key: 'diagnostics', label: 'Diagnostika', category: 'Diagnostika' },
  { key: 'medicines', label: 'Dori vositalari', category: 'Resurslar' },
  { key: 'medicalEquipment', label: 'Tibbiy uskunalar', category: 'Resurslar' },
  { key: 'digital', label: 'AKT va raqamlashtirish', category: 'Raqamlashtirish' },
  { key: 'dmed', label: 'DMED nazorati', category: 'Raqamlashtirish' },
  { key: 'finance', label: 'Moliya', category: 'Moliya' },
  { key: 'paidServices', label: 'Pullik xizmatlar', category: 'Moliya' },
  { key: 'procurement', label: 'Xarid va shartnomalar', category: 'Moliya' },
  { key: 'infrastructure', label: 'Bino va infratuzilma', category: 'Infratuzilma' },
  { key: 'transport', label: 'Transport', category: 'Infratuzilma' },
  { key: 'appeals', label: 'Murojaatlar', category: 'Nazorat' },
  { key: 'qr', label: 'QR baholash', category: 'Nazorat' },
  { key: 'execution', label: 'Ijro intizomi', category: 'Nazorat' },
  { key: 'kpi', label: 'KPI', category: 'Nazorat' },
  { key: 'quality', label: 'Sifat ko‘rsatkichlari', category: 'Sifat va xavf' },
  { key: 'infectionControl', label: 'Infeksiya va sanitariya', category: 'Sifat va xavf' },
  { key: 'mortality', label: 'O‘lim va og‘ir holatlar', category: 'Sifat va xavf' },
  { key: 'telemedicine', label: 'Telemeditsina', category: 'Aloqa' },
  { key: 'meetings', label: 'Zoom / yig‘ilish intizomi', category: 'Aloqa' },
  { key: 'alerts', label: 'Xavf va ogohlantirishlar', category: 'Sifat va xavf' }
] as const;

export type ModuleKey = typeof moduleDefinitions[number]['key'];

const templates: Record<ModuleKey, [string, string, string?][]> = {
  passport: [['population','Xizmat ko‘rsatadigan aholi','nafar'],['capacity','Quvvati','qabul/kun'],['buildings','Bino soni','ta'],['departments','Bo‘linmalar','ta']],
  staff: [['staffTotal','Jami shtat','birlik'],['doctors','Shifokorlar','nafar'],['nurses','Hamshiralar','nafar'],['vacancy','Vakant shtat','%'],['certificates','Sertifikati amaldagi xodimlar','%']],
  patients: [['attached','Biriktirilgan aholi','nafar'],['children','Bolalar','nafar'],['pregnant','Homiladorlar','nafar'],['chronic','Surunkali bemorlar','nafar'],['disability','Nogironligi bo‘lgan shaxslar','nafar']],
  admissions: [['daily','Kunlik qabul','ta'],['monthly','Oylik qabul','ta'],['homeVisits','Uyga chaqiruv','ta'],['waitingTime','O‘rtacha kutish','daqiqa'],['doctorLoad','Bir shifokor yuklamasi','bemor/kun']],
  diseases: [['newCases','Yangi aniqlangan','ta'],['topDiagnosis','Eng ko‘p tashxis'],['infectious','Yuqumli kasalliklar','ta'],['cardio','Yurak-qon tomir','ta'],['diabetes','Diabet','ta']],
  inpatient: [['beds','O‘rinlar','ta'],['occupiedBeds','Band o‘rinlar','ta'],['occupancy','O‘rin bandligi','%'],['avgStay','O‘rtacha yotish','kun'],['operations','Operatsiyalar','ta']],
  emergency: [['calls','Chaqiruvlar','ta'],['avgArrival','Yetib borish vaqti','daqiqa'],['lateCalls','Kechikkan chaqiruvlar','ta'],['hospitalized','Gospitalizatsiya','ta']],
  maternalChild: [['pregnantRegistered','Ro‘yxatdagi homiladorlar','nafar'],['highRisk','Yuqori xavf guruhi','nafar'],['births','Tug‘ruqlar','ta'],['cSection','Kesarcha kesish','ta'],['infantMortality','Chaqaloq o‘limi','ta']],
  screening: [['plan','Skrining rejasi','nafar'],['screened','Skriningdan o‘tgan','nafar'],['coverage','Qamrov','%'],['detected','Aniqlangan kasalliklar','ta']],
  laboratory: [['tests','Tahlillar','ta'],['turnaround','Natija chiqish vaqti','daqiqa'],['critical','Kritik natijalar','ta'],['dmedTransferred','DMEDga uzatilgan','%']],
  diagnostics: [['ultrasound','UZI','ta'],['xray','Rentgen','ta'],['ct','KT','ta'],['mri','MRT','ta'],['queue','Diagnostika navbati','nafar']],
  medicines: [['stockItems','Dori nomenklaturasi','ta'],['criticalStock','Kritik qoldiq','ta'],['outOfStock','Tugagan dorilar','ta'],['expiring','Muddati yaqin','ta'],['ePrescription','Elektron retsept','%']],
  medicalEquipment: [['equipmentTotal','Jami apparatlar','ta'],['working','Ishlayotgan','ta'],['faulty','Nosoz','ta'],['repair','Ta’mirda','ta'],['serviceDue','Texnik xizmat muddati kelgan','ta']],
  digital: [['computers','Kompyuterlar','ta'],['laptops','Noutbuklar','ta'],['tablets','Planshetlar','ta'],['internetSpeed','Internet tezligi','Mbit/s'],['faultyDevices','Nosoz AKT','ta']],
  dmed: [['activeUsers','Faol DMED foydalanuvchilari','nafar'],['dmedActivity','DMED faolligi','%'],['ePrescription','Elektron retsept','%'],['electronicDocs','Elektron hujjatlar','ta'],['labResults','Laboratoriya natijalari','ta']],
  finance: [['budget','Byudjet','so‘m'],['funding','Moliyalashtirish','so‘m'],['expenses','Xarajat','so‘m'],['receivable','Debitor','so‘m'],['payable','Kreditor','so‘m']],
  paidServices: [['revenue','Tushum','so‘m'],['services','Xizmatlar','ta'],['contracts','Shartnomalar','ta'],['debt','Qarzdorlik','so‘m']],
  procurement: [['purchases','Xaridlar','ta'],['contractValue','Shartnoma qiymati','so‘m'],['lateSupply','Kechikkan yetkazib berish','ta'],['rejectedGoods','Sifatsiz tovar','ta']],
  infrastructure: [['buildings','Binolar','ta'],['needsRepair','Ta’mir talab','ta'],['generators','Generatorlar','ta'],['oxygen','Kislorod tizimi','holat'],['fireSafety','Yong‘in xavfsizligi','holat']],
  transport: [['vehicles','Transport','ta'],['ambulances','Tez yordam mashinalari','ta'],['workingVehicles','Ishlayotgan','ta'],['faultyVehicles','Nosoz','ta'],['gpsOnline','GPS online','%']],
  appeals: [['openAppeals','Ochiq murojaatlar','ta'],['inProgress','Jarayonda','ta'],['resolved','Hal qilingan','ta'],['overdue','Kechikkan','ta'],['repeat','Takroriy','ta']],
  qr: [['qrRatings','Baholashlar','ta'],['qrRating','O‘rtacha baho','5 dan'],['complaints','Shikoyatlar','ta'],['suggestions','Takliflar','ta']],
  execution: [['tasks','Topshiriqlar','ta'],['completed','Bajarilgan','ta'],['overdue','Kechikkan','ta'],['completion','Ijro','%']],
  kpi: [['score','KPI ball','100 dan'],['rank','Reyting o‘rni'],['daily','Kunlik ball','ball'],['monthly','Oylik ball','ball'],['cumulative','Jami yig‘ilgan','ball']],
  quality: [['readmission','Qayta yotqizilish','%'],['complications','Asoratlar','ta'],['patientSatisfaction','Bemor qoniqishi','%'],['protocolCompliance','Klinik protokol','%']],
  infectionControl: [['hai','Kasalxona ichi infeksiyasi','ta'],['sterilization','Sterilizatsiya nazorati','%'],['medicalWaste','Tibbiy chiqindi','holat'],['sanitary','Sanitariya holati','%']],
  mortality: [['deaths','Jami o‘lim','ta'],['inpatientDeaths','Statsionar o‘lim','ta'],['maternalDeaths','Ona o‘limi','ta'],['infantDeaths','Chaqaloq o‘limi','ta'],['audited','Audit qilingan','%']],
  telemedicine: [['consultations','Konsiliumlar','ta'],['republicConsults','Respublika markazi bilan','ta'],['criticalPatients','Og‘ir bemorlar','ta'],['recommendationsDone','Tavsiyalar bajarilishi','%']],
  meetings: [['invited','Taklif etilgan','nafar'],['attended','Qatnashgan','nafar'],['late','Kechikkan','nafar'],['cameraOff','Kamera o‘chiq','nafar']],
  alerts: [['critical','Kritik ogohlantirish','ta'],['high','Yuqori xavf','ta'],['medium','O‘rta xavf','ta'],['unresolved','Yopilmagan','ta']]
};

export function unavailableMetric(key: string, label: string, unit?: string): ModuleMetric {
  return { key, label, value: null, unit: unit ?? null, sourceStatus: 'unavailable', sourceName: null, fetchedAt: null };
}

export function buildUnavailableModules(): InstitutionModulePayload[] {
  return moduleDefinitions.map(m => ({
    key: m.key,
    label: m.label,
    category: m.category,
    status: 'unavailable',
    metrics: templates[m.key].map(([key,label,unit]) => unavailableMetric(key,label,unit))
  }));
}

function statusFromMetrics(metrics: ModuleMetric[]): SourceStatus {
  if (metrics.some(x => x.sourceStatus === 'error')) return 'error';
  if (metrics.some(x => x.sourceStatus === 'live')) return 'live';
  if (metrics.some(x => x.sourceStatus === 'manual')) return 'manual';
  if (metrics.some(x => x.sourceStatus === 'imported')) return 'imported';
  return 'unavailable';
}

export function buildInstitutionModules(institution: Institution, stored: InstitutionMetric[] = []): InstitutionModulePayload[] {
  const modules = buildUnavailableModules();
  const district = institution.districtKey;
  const passportValues: Record<string, string | number | null> = {
    population: null,
    capacity: null,
    buildings: null,
    departments: null
  };
  const passport = modules.find(x => x.key === 'passport')!;
  passport.metrics.unshift(
    { key:'officialName', label:'Rasmiy nomi', value:institution.officialName, unit:null, sourceStatus:'imported', sourceName:'Muassasalar katalogi', fetchedAt:null },
    { key:'type', label:'Turi', value:institution.type, unit:null, sourceStatus:'imported', sourceName:'Muassasalar katalogi', fetchedAt:null },
    { key:'district', label:'Hudud', value:district, unit:null, sourceStatus:'imported', sourceName:'Muassasalar katalogi', fetchedAt:null },
    { key:'address', label:'Manzil', value:institution.address, unit:null, sourceStatus:institution.address ? 'imported':'unavailable', sourceName:institution.address ? 'Muassasalar katalogi':null, fetchedAt:null },
    { key:'leader', label:'Rahbar', value:institution.leaderName, unit:null, sourceStatus:institution.leaderName ? 'imported':'unavailable', sourceName:institution.leaderName ? 'Muassasalar katalogi':null, fetchedAt:null },
    { key:'phone', label:'Telefon', value:institution.phone, unit:null, sourceStatus:institution.phone ? 'imported':'unavailable', sourceName:institution.phone ? 'Muassasalar katalogi':null, fetchedAt:null }
  );
  passport.status = statusFromMetrics(passport.metrics);

  for (const saved of stored) {
    for (const module of modules) {
      const metric = module.metrics.find(x => x.key === saved.metricKey);
      if (!metric) continue;
      metric.value = saved.metricValue;
      metric.unit = saved.unit ?? metric.unit ?? null;
      metric.sourceStatus = saved.sourceType === 'unavailable' ? 'unavailable' : saved.sourceType;
      metric.sourceName = saved.sourceName;
      metric.fetchedAt = saved.fetchedAt;
      module.status = statusFromMetrics(module.metrics);
    }
  }
  void passportValues;
  return modules;
}

export function metricExists(metricKey: string) {
  return Object.values(templates).some(rows => rows.some(([key]) => key === metricKey));
}
