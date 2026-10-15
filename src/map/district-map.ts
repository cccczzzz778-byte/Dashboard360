const aliases: Record<string, string> = {
  "g'ijduvon": 'gijduvon', "g‘ijduvon": 'gijduvon', gijduvon: 'gijduvon',
  qorovulbozor: 'qorovulbozor', qoravulbozor: 'qorovulbozor',
  'buxoro shahri': 'buxoro-shahar', 'buxoro shahar': 'buxoro-shahar',
  'kogon shahri': 'kogon-shahar', 'kogon shahar': 'kogon-shahar',
  'buxoro tumani': 'buxoro-tumani', 'buxoro tuman': 'buxoro-tumani',
  'kogon tumani': 'kogon-tumani', 'kogon tuman': 'kogon-tumani',
  jondor: 'jondor', olot: 'olot', peshku: 'peshku', qorakol: 'qorakol', "qorako'l": 'qorakol', "qorako‘l": 'qorakol',
  romitan: 'romitan', shofirkon: 'shofirkon', vobkent: 'vobkent'
};

export const districtKeys = [
  'buxoro-shahar', 'buxoro-tumani', 'gijduvon', 'jondor', 'kogon-shahar', 'kogon-tumani',
  'olot', 'peshku', 'qorakol', 'qorovulbozor', 'romitan', 'shofirkon', 'vobkent'
] as const;

export function normalizeDistrictName(value: string) {
  const key = value.toLowerCase().trim().replace(/tumani|tum\.|tuman/g, 'tuman').replace(/shahri|sh\./g, 'shahar').replace(/\s+/g, ' ');
  if (aliases[key]) return aliases[key];
  const bare = key.replace(/ tuman$/, '').replace(/ shahar$/, '');
  return aliases[bare] ?? bare.replace(/[ʻ’‘']/g, '');
}

export function isKnownDistrict(value: string) {
  return districtKeys.includes(normalizeDistrictName(value) as any);
}
