import type { Institution } from './domain/institution.js';

export type District = {
  key: string;
  label: string;
  kind: 'city' | 'district';
  latitude: number;
  longitude: number;
};

export const districts: District[] = [
  { key: 'buxoro-shahar', label: 'Buxoro shahri', kind: 'city', latitude: 39.7681, longitude: 64.4556 },
  { key: 'buxoro-tumani', label: 'Buxoro tumani', kind: 'district', latitude: 39.7480, longitude: 64.3500 },
  { key: 'gijduvon', label: 'G‘ijduvon tumani', kind: 'district', latitude: 40.1000, longitude: 64.6830 },
  { key: 'jondor', label: 'Jondor tumani', kind: 'district', latitude: 39.7410, longitude: 64.1800 },
  { key: 'kogon-shahar', label: 'Kogon shahri', kind: 'city', latitude: 39.7228, longitude: 64.5517 },
  { key: 'kogon-tumani', label: 'Kogon tumani', kind: 'district', latitude: 39.7050, longitude: 64.6100 },
  { key: 'olot', label: 'Olot tumani', kind: 'district', latitude: 39.4150, longitude: 63.8020 },
  { key: 'peshku', label: 'Peshku tumani', kind: 'district', latitude: 40.0250, longitude: 64.0100 },
  { key: 'qorakol', label: 'Qorako‘l tumani', kind: 'district', latitude: 39.4990, longitude: 63.8550 },
  { key: 'qorovulbozor', label: 'Qorovulbozor tumani', kind: 'district', latitude: 39.5000, longitude: 64.7900 },
  { key: 'romitan', label: 'Romitan tumani', kind: 'district', latitude: 39.9290, longitude: 64.3820 },
  { key: 'shofirkon', label: 'Shofirkon tumani', kind: 'district', latitude: 40.1200, longitude: 64.5020 },
  { key: 'vobkent', label: 'Vobkent tumani', kind: 'district', latitude: 40.0300, longitude: 64.5150 }
];

const districtInstitution = (id: string, officialName: string, type: string, districtKey: string): Institution => {
  const district = districts.find(x => x.key === districtKey)!;
  return {
    id, officialName, type, districtKey,
    address: null, leaderName: null, phone: null,
    latitude: district.latitude, longitude: district.longitude,
    locationAccuracy: district.kind === 'city' ? 'city-center' : 'district-center'
  };
};

export const institutionCatalog: Institution[] = [
  {
    id: 'shtb-buxoro', officialName: 'Buxoro shahar tibbiyot birlashmasi', type: 'SHTB', districtKey: 'buxoro-shahar',
    address: null, leaderName: null, phone: null,
    latitude: 39.7448, longitude: 64.44251, locationAccuracy: 'exact'
  },
  districtInstitution('ttb-buxoro', 'Buxoro tuman tibbiyot birlashmasi', 'TTB', 'buxoro-tumani'),
  districtInstitution('ttb-gijduvon', 'G‘ijduvon tuman tibbiyot birlashmasi', 'TTB', 'gijduvon'),
  districtInstitution('ttb-jondor', 'Jondor tuman tibbiyot birlashmasi', 'TTB', 'jondor'),
  {
    id: 'shtb-kogon', officialName: 'Kogon shahar tibbiyot birlashmasi', type: 'SHTB', districtKey: 'kogon-shahar',
    address: 'Kogon, 1', leaderName: null, phone: null,
    latitude: 39.728586, longitude: 64.545346, locationAccuracy: 'exact'
  },
  districtInstitution('ttb-kogon', 'Kogon tuman tibbiyot birlashmasi', 'TTB', 'kogon-tumani'),
  districtInstitution('ttb-olot', 'Olot tuman tibbiyot birlashmasi', 'TTB', 'olot'),
  districtInstitution('ttb-peshku', 'Peshku tuman tibbiyot birlashmasi', 'TTB', 'peshku'),
  districtInstitution('ttb-qorakol', 'Qorako‘l tuman tibbiyot birlashmasi', 'TTB', 'qorakol'),
  districtInstitution('ttb-qorovulbozor', 'Qorovulbozor tuman tibbiyot birlashmasi', 'TTB', 'qorovulbozor'),
  districtInstitution('ttb-romitan', 'Romitan tuman tibbiyot birlashmasi', 'TTB', 'romitan'),
  districtInstitution('ttb-shofirkon', 'Shofirkon tuman tibbiyot birlashmasi', 'TTB', 'shofirkon'),
  districtInstitution('ttb-vobkent', 'Vobkent tuman tibbiyot birlashmasi', 'TTB', 'vobkent'),
  districtInstitution('vkttm', 'Buxoro viloyat ko‘p tarmoqli tibbiyot markazi', 'Viloyat markazi', 'buxoro-shahar'),
  districtInstitution('vbkttm', 'Buxoro viloyat bolalar ko‘p tarmoqli tibbiyot markazi', 'Viloyat markazi', 'buxoro-shahar'),
  districtInstitution('rsh-tiy-buxoro', 'Respublika shoshilinch tibbiy yordam ilmiy markazi Buxoro filiali', 'Respublika filiali', 'buxoro-shahar'),
  districtInstitution('onkologiya-buxoro', 'Respublika ixtisoslashtirilgan onkologiya va radiologiya markazi Buxoro filiali', 'Respublika filiali', 'buxoro-shahar'),
  districtInstitution('tugruq-buxoro', 'Buxoro shahar tug‘ruq kompleksi', 'Tug‘ruq kompleksi', 'buxoro-shahar'),
  districtInstitution('diagnostika-buxoro', 'Buxoro tibbiy diagnostika markazi', 'Diagnostika markazi', 'buxoro-shahar'),
  districtInstitution('oits-buxoro', 'Buxoro viloyati OITSga qarshi kurash markazi', 'Viloyat markazi', 'buxoro-shahar'),
  districtInstitution('qon-buxoro', 'Buxoro viloyati qon quyish markazi', 'Viloyat markazi', 'buxoro-shahar'),
  districtInstitution('ona-bola-buxoro', 'Ona va bola salomatligi markazi Buxoro filiali', 'Respublika filiali', 'buxoro-shahar'),
  districtInstitution('ruhiy-buxoro', 'Buxoro viloyati ruhiy salomatlik markazi', 'Viloyat markazi', 'buxoro-shahar')
];

export const integrations = [
  { key: 'dmed-211', label: 'DMED · Dashboard 211', group: 'DMED Superset', url: 'https://bi.dmed.uz/superset/dashboard/211/?native_filters_key=DMTQe52lAog', auth: 'browser-session' },
  { key: 'dmed-112', label: 'DMED · Dashboard 112', group: 'DMED Superset', url: 'https://bi.dmed.uz/superset/dashboard/112/?native_filters_key=_vByOAPc9m0', auth: 'browser-session' },
  { key: 'dmed-98', label: 'DMED · Dashboard 98', group: 'DMED Superset', url: 'https://bi.dmed.uz/superset/dashboard/98/?native_filters_key=yaB3f_2w8as', auth: 'browser-session' },
  { key: 'dmed-115', label: 'DMED · Dashboard 115', group: 'DMED Superset', url: 'https://bi.dmed.uz/superset/dashboard/115/?native_filters_key=VnDhZ7hegFg', auth: 'browser-session' },
  { key: 'dmed-136', label: 'DMED · Dashboard 136', group: 'DMED Superset', url: 'https://bi.dmed.uz/superset/dashboard/136/?native_filters_key=_TGanBop3gs', auth: 'browser-session' },
  { key: 'ona-bola', label: 'Ona-bola registri', group: 'Registr', url: 'https://ona-bola-registry.vercel.app/#/dashboard', auth: 'external' }
];

export function catalogByDistrict(districtKey: string) {
  return institutionCatalog.filter(x => x.districtKey === districtKey);
}

export function catalogInstitution(id: string) {
  return institutionCatalog.find(x => x.id === id) ?? null;
}
