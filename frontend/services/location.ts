import api from './api';
import logger from '../utils/logger';

// Configuration: Set to false if backend API endpoints are not implemented yet
// When your backend implements the location endpoints, change this to true
const USE_LOCATION_API = false;

export interface Country {
  name: string;
  code: string;
  states?: State[];
}

export interface State {
  name: string;
  code: string;
  countryCode: string;
}

// Cache for countries and states
let countriesCache: Country[] | null = null;
let statesCache: { [countryCode: string]: State[] } = {};

export const getCountries = async (): Promise<Country[]> => {
  try {
    if (countriesCache) {
      return countriesCache;
    }

    // Only try API if enabled
    if (USE_LOCATION_API) {
      try {
        const response = await api.get('/locations/countries');
        const countriesData = response.data.countries || [];
        countriesCache = countriesData;
        return countriesData;
      } catch (apiError: any) {
        logger.debug('Using static countries data (API endpoint not available)');
      }
    } else {
      logger.debug('Using static countries data (API disabled)');
    }
  } catch (error: any) {
    logger.debug('Using static countries data (API unavailable)');
  }
  
  // Fallback to static data if API fails or doesn't exist
  return [
      { name: 'United States', code: 'US' },
      { name: 'United Kingdom', code: 'GB' },
      { name: 'Canada', code: 'CA' },
      { name: 'Australia', code: 'AU' },
      { name: 'Germany', code: 'DE' },
      { name: 'France', code: 'FR' },
      { name: 'Italy', code: 'IT' },
      { name: 'Spain', code: 'ES' },
      { name: 'Japan', code: 'JP' },
      { name: 'India', code: 'IN' },
      { name: 'Brazil', code: 'BR' },
      { name: 'Mexico', code: 'MX' },
      { name: 'Netherlands', code: 'NL' },
      { name: 'Sweden', code: 'SE' },
      { name: 'Norway', code: 'NO' },
      { name: 'Denmark', code: 'DK' },
      { name: 'Finland', code: 'FI' },
      { name: 'Switzerland', code: 'CH' },
      { name: 'Austria', code: 'AT' },
      { name: 'Belgium', code: 'BE' },
      { name: 'Portugal', code: 'PT' },
      { name: 'Greece', code: 'GR' },
      { name: 'Turkey', code: 'TR' },
      { name: 'Poland', code: 'PL' },
      { name: 'Czech Republic', code: 'CZ' },
      { name: 'Hungary', code: 'HU' },
      { name: 'Romania', code: 'RO' },
      { name: 'Bulgaria', code: 'BG' },
      { name: 'Croatia', code: 'HR' },
      { name: 'Slovenia', code: 'SI' },
      { name: 'Slovakia', code: 'SK' },
      { name: 'Estonia', code: 'EE' },
      { name: 'Latvia', code: 'LV' },
      { name: 'Lithuania', code: 'LT' },
      { name: 'Ireland', code: 'IE' },
      { name: 'Iceland', code: 'IS' },
      { name: 'Luxembourg', code: 'LU' },
      { name: 'Malta', code: 'MT' },
      { name: 'Cyprus', code: 'CY' },
      { name: 'South Korea', code: 'KR' },
      { name: 'Singapore', code: 'SG' },
      { name: 'Thailand', code: 'TH' },
      { name: 'Malaysia', code: 'MY' },
      { name: 'Indonesia', code: 'ID' },
      { name: 'Philippines', code: 'PH' },
      { name: 'Vietnam', code: 'VN' },
      { name: 'New Zealand', code: 'NZ' },
      { name: 'South Africa', code: 'ZA' },
      { name: 'Egypt', code: 'EG' },
      { name: 'Morocco', code: 'MA' },
      { name: 'Tunisia', code: 'TN' },
      { name: 'Argentina', code: 'AR' },
      { name: 'Chile', code: 'CL' },
      { name: 'Colombia', code: 'CO' },
      { name: 'Peru', code: 'PE' },
      { name: 'Uruguay', code: 'UY' },
      { name: 'Ecuador', code: 'EC' },
      { name: 'Venezuela', code: 'VE' },
      { name: 'Bolivia', code: 'BO' },
      { name: 'Paraguay', code: 'PY' },
      { name: 'Guyana', code: 'GY' },
      { name: 'Suriname', code: 'SR' },
      { name: 'China', code: 'CN' },
      { name: 'Russia', code: 'RU' },
      { name: 'Ukraine', code: 'UA' },
      { name: 'Belarus', code: 'BY' },
      { name: 'Moldova', code: 'MD' },
      { name: 'Georgia', code: 'GE' },
      { name: 'Armenia', code: 'AM' },
      { name: 'Azerbaijan', code: 'AZ' },
      { name: 'Kazakhstan', code: 'KZ' },
      { name: 'Uzbekistan', code: 'UZ' },
      { name: 'Kyrgyzstan', code: 'KG' },
      { name: 'Tajikistan', code: 'TJ' },
      { name: 'Turkmenistan', code: 'TM' },
      { name: 'Mongolia', code: 'MN' },
      { name: 'Afghanistan', code: 'AF' },
      { name: 'Pakistan', code: 'PK' },
      { name: 'Bangladesh', code: 'BD' },
      { name: 'Sri Lanka', code: 'LK' },
      { name: 'Nepal', code: 'NP' },
      { name: 'Bhutan', code: 'BT' },
      { name: 'Myanmar', code: 'MM' },
      { name: 'Laos', code: 'LA' },
      { name: 'Cambodia', code: 'KH' },
      { name: 'Brunei', code: 'BN' },
      { name: 'Taiwan', code: 'TW' },
      { name: 'Hong Kong', code: 'HK' },
      { name: 'Macau', code: 'MO' },
    ];
  }
;

export const getStatesByCountry = async (countryCode: string): Promise<State[]> => {
  try {
    if (statesCache[countryCode]) {
      return statesCache[countryCode];
    }

    // Only try API if enabled
    if (USE_LOCATION_API) {
      try {
        const response = await api.get(`/locations/states/${countryCode}`);
        const states = response.data.states || [];
        statesCache[countryCode] = states;
        return states;
      } catch (apiError: any) {
        logger.debug(`Using static states data for ${countryCode} (API endpoint not available)`);
      }
    } else {
      logger.debug(`Using static states data for ${countryCode} (API disabled)`);
    }
  } catch (error: any) {
    logger.debug(`Using static states data for ${countryCode} (API unavailable)`);
  }
  
  // Fallback to static data if API fails or doesn't exist
  const staticStates: { [key: string]: State[] } = {
      'US': [
        { name: 'Alabama', code: 'AL', countryCode: 'US' },
        { name: 'Alaska', code: 'AK', countryCode: 'US' },
        { name: 'Arizona', code: 'AZ', countryCode: 'US' },
        { name: 'Arkansas', code: 'AR', countryCode: 'US' },
        { name: 'California', code: 'CA', countryCode: 'US' },
        { name: 'Colorado', code: 'CO', countryCode: 'US' },
        { name: 'Connecticut', code: 'CT', countryCode: 'US' },
        { name: 'Delaware', code: 'DE', countryCode: 'US' },
        { name: 'Florida', code: 'FL', countryCode: 'US' },
        { name: 'Georgia', code: 'GA', countryCode: 'US' },
        { name: 'Hawaii', code: 'HI', countryCode: 'US' },
        { name: 'Idaho', code: 'ID', countryCode: 'US' },
        { name: 'Illinois', code: 'IL', countryCode: 'US' },
        { name: 'Indiana', code: 'IN', countryCode: 'US' },
        { name: 'Iowa', code: 'IA', countryCode: 'US' },
        { name: 'Kansas', code: 'KS', countryCode: 'US' },
        { name: 'Kentucky', code: 'KY', countryCode: 'US' },
        { name: 'Louisiana', code: 'LA', countryCode: 'US' },
        { name: 'Maine', code: 'ME', countryCode: 'US' },
        { name: 'Maryland', code: 'MD', countryCode: 'US' },
        { name: 'Massachusetts', code: 'MA', countryCode: 'US' },
        { name: 'Michigan', code: 'MI', countryCode: 'US' },
        { name: 'Minnesota', code: 'MN', countryCode: 'US' },
        { name: 'Mississippi', code: 'MS', countryCode: 'US' },
        { name: 'Missouri', code: 'MO', countryCode: 'US' },
        { name: 'Montana', code: 'MT', countryCode: 'US' },
        { name: 'Nebraska', code: 'NE', countryCode: 'US' },
        { name: 'Nevada', code: 'NV', countryCode: 'US' },
        { name: 'New Hampshire', code: 'NH', countryCode: 'US' },
        { name: 'New Jersey', code: 'NJ', countryCode: 'US' },
        { name: 'New Mexico', code: 'NM', countryCode: 'US' },
        { name: 'New York', code: 'NY', countryCode: 'US' },
        { name: 'North Carolina', code: 'NC', countryCode: 'US' },
        { name: 'North Dakota', code: 'ND', countryCode: 'US' },
        { name: 'Ohio', code: 'OH', countryCode: 'US' },
        { name: 'Oklahoma', code: 'OK', countryCode: 'US' },
        { name: 'Oregon', code: 'OR', countryCode: 'US' },
        { name: 'Pennsylvania', code: 'PA', countryCode: 'US' },
        { name: 'Rhode Island', code: 'RI', countryCode: 'US' },
        { name: 'South Carolina', code: 'SC', countryCode: 'US' },
        { name: 'South Dakota', code: 'SD', countryCode: 'US' },
        { name: 'Tennessee', code: 'TN', countryCode: 'US' },
        { name: 'Texas', code: 'TX', countryCode: 'US' },
        { name: 'Utah', code: 'UT', countryCode: 'US' },
        { name: 'Vermont', code: 'VT', countryCode: 'US' },
        { name: 'Virginia', code: 'VA', countryCode: 'US' },
        { name: 'Washington', code: 'WA', countryCode: 'US' },
        { name: 'West Virginia', code: 'WV', countryCode: 'US' },
        { name: 'Wisconsin', code: 'WI', countryCode: 'US' },
        { name: 'Wyoming', code: 'WY', countryCode: 'US' },
      ],
      'GB': [
        { name: 'England', code: 'ENG', countryCode: 'GB' },
        { name: 'Scotland', code: 'SCT', countryCode: 'GB' },
        { name: 'Wales', code: 'WLS', countryCode: 'GB' },
        { name: 'Northern Ireland', code: 'NIR', countryCode: 'GB' },
        { name: 'London', code: 'LON', countryCode: 'GB' },
        { name: 'Birmingham', code: 'BIR', countryCode: 'GB' },
        { name: 'Manchester', code: 'MAN', countryCode: 'GB' },
        { name: 'Liverpool', code: 'LIV', countryCode: 'GB' },
        { name: 'Leeds', code: 'LEE', countryCode: 'GB' },
        { name: 'Sheffield', code: 'SHE', countryCode: 'GB' },
        { name: 'Bristol', code: 'BRI', countryCode: 'GB' },
        { name: 'Newcastle', code: 'NEW', countryCode: 'GB' },
        { name: 'Nottingham', code: 'NOT', countryCode: 'GB' },
        { name: 'Leicester', code: 'LEI', countryCode: 'GB' },
        { name: 'Coventry', code: 'COV', countryCode: 'GB' },
        { name: 'Bradford', code: 'BRA', countryCode: 'GB' },
        { name: 'Cardiff', code: 'CAR', countryCode: 'GB' },
        { name: 'Belfast', code: 'BEL', countryCode: 'GB' },
        { name: 'Glasgow', code: 'GLA', countryCode: 'GB' },
        { name: 'Edinburgh', code: 'EDI', countryCode: 'GB' },
      ],
      'CA': [
        { name: 'Alberta', code: 'AB', countryCode: 'CA' },
        { name: 'British Columbia', code: 'BC', countryCode: 'CA' },
        { name: 'Manitoba', code: 'MB', countryCode: 'CA' },
        { name: 'New Brunswick', code: 'NB', countryCode: 'CA' },
        { name: 'Newfoundland and Labrador', code: 'NL', countryCode: 'CA' },
        { name: 'Northwest Territories', code: 'NT', countryCode: 'CA' },
        { name: 'Nova Scotia', code: 'NS', countryCode: 'CA' },
        { name: 'Nunavut', code: 'NU', countryCode: 'CA' },
        { name: 'Ontario', code: 'ON', countryCode: 'CA' },
        { name: 'Prince Edward Island', code: 'PE', countryCode: 'CA' },
        { name: 'Quebec', code: 'QC', countryCode: 'CA' },
        { name: 'Saskatchewan', code: 'SK', countryCode: 'CA' },
        { name: 'Yukon', code: 'YT', countryCode: 'CA' },
      ],
      'AU': [
        { name: 'Australian Capital Territory', code: 'ACT', countryCode: 'AU' },
        { name: 'New South Wales', code: 'NSW', countryCode: 'AU' },
        { name: 'Northern Territory', code: 'NT', countryCode: 'AU' },
        { name: 'Queensland', code: 'QLD', countryCode: 'AU' },
        { name: 'South Australia', code: 'SA', countryCode: 'AU' },
        { name: 'Tasmania', code: 'TAS', countryCode: 'AU' },
        { name: 'Victoria', code: 'VIC', countryCode: 'AU' },
        { name: 'Western Australia', code: 'WA', countryCode: 'AU' },
      ],
      'DE': [
        { name: 'Baden-Württemberg', code: 'BW', countryCode: 'DE' },
        { name: 'Bavaria', code: 'BY', countryCode: 'DE' },
        { name: 'Berlin', code: 'BE', countryCode: 'DE' },
        { name: 'Brandenburg', code: 'BB', countryCode: 'DE' },
        { name: 'Bremen', code: 'HB', countryCode: 'DE' },
        { name: 'Hamburg', code: 'HH', countryCode: 'DE' },
        { name: 'Hesse', code: 'HE', countryCode: 'DE' },
        { name: 'Lower Saxony', code: 'NI', countryCode: 'DE' },
        { name: 'Mecklenburg-Vorpommern', code: 'MV', countryCode: 'DE' },
        { name: 'North Rhine-Westphalia', code: 'NW', countryCode: 'DE' },
        { name: 'Rhineland-Palatinate', code: 'RP', countryCode: 'DE' },
        { name: 'Saarland', code: 'SL', countryCode: 'DE' },
        { name: 'Saxony', code: 'SN', countryCode: 'DE' },
        { name: 'Saxony-Anhalt', code: 'ST', countryCode: 'DE' },
        { name: 'Schleswig-Holstein', code: 'SH', countryCode: 'DE' },
        { name: 'Thuringia', code: 'TH', countryCode: 'DE' },
      ],
      'FR': [
        { name: 'Auvergne-Rhône-Alpes', code: 'ARA', countryCode: 'FR' },
        { name: 'Bourgogne-Franche-Comté', code: 'BFC', countryCode: 'FR' },
        { name: 'Brittany', code: 'BRE', countryCode: 'FR' },
        { name: 'Centre-Val de Loire', code: 'CVL', countryCode: 'FR' },
        { name: 'Corsica', code: 'COR', countryCode: 'FR' },
        { name: 'Grand Est', code: 'GES', countryCode: 'FR' },
        { name: 'Hauts-de-France', code: 'HDF', countryCode: 'FR' },
        { name: 'Île-de-France', code: 'IDF', countryCode: 'FR' },
        { name: 'Normandy', code: 'NOR', countryCode: 'FR' },
        { name: 'Nouvelle-Aquitaine', code: 'NAQ', countryCode: 'FR' },
        { name: 'Occitanie', code: 'OCC', countryCode: 'FR' },
        { name: 'Pays de la Loire', code: 'PDL', countryCode: 'FR' },
        { name: 'Provence-Alpes-Côte d\'Azur', code: 'PAC', countryCode: 'FR' },
      ],
      'IT': [
        { name: 'Abruzzo', code: 'ABR', countryCode: 'IT' },
        { name: 'Basilicata', code: 'BAS', countryCode: 'IT' },
        { name: 'Calabria', code: 'CAL', countryCode: 'IT' },
        { name: 'Campania', code: 'CAM', countryCode: 'IT' },
        { name: 'Emilia-Romagna', code: 'EMR', countryCode: 'IT' },
        { name: 'Friuli-Venezia Giulia', code: 'FVG', countryCode: 'IT' },
        { name: 'Lazio', code: 'LAZ', countryCode: 'IT' },
        { name: 'Liguria', code: 'LIG', countryCode: 'IT' },
        { name: 'Lombardy', code: 'LOM', countryCode: 'IT' },
        { name: 'Marche', code: 'MAR', countryCode: 'IT' },
        { name: 'Molise', code: 'MOL', countryCode: 'IT' },
        { name: 'Piedmont', code: 'PIE', countryCode: 'IT' },
        { name: 'Apulia', code: 'PUG', countryCode: 'IT' },
        { name: 'Sardinia', code: 'SAR', countryCode: 'IT' },
        { name: 'Sicily', code: 'SIC', countryCode: 'IT' },
        { name: 'Tuscany', code: 'TOS', countryCode: 'IT' },
        { name: 'Trentino-Alto Adige', code: 'TAA', countryCode: 'IT' },
        { name: 'Umbria', code: 'UMB', countryCode: 'IT' },
        { name: 'Aosta Valley', code: 'VDA', countryCode: 'IT' },
        { name: 'Veneto', code: 'VEN', countryCode: 'IT' },
      ],
      'ES': [
        { name: 'Andalusia', code: 'AN', countryCode: 'ES' },
        { name: 'Aragon', code: 'AR', countryCode: 'ES' },
        { name: 'Asturias', code: 'AS', countryCode: 'ES' },
        { name: 'Balearic Islands', code: 'IB', countryCode: 'ES' },
        { name: 'Basque Country', code: 'PV', countryCode: 'ES' },
        { name: 'Canary Islands', code: 'CN', countryCode: 'ES' },
        { name: 'Cantabria', code: 'CB', countryCode: 'ES' },
        { name: 'Castile and León', code: 'CL', countryCode: 'ES' },
        { name: 'Castilla-La Mancha', code: 'CM', countryCode: 'ES' },
        { name: 'Catalonia', code: 'CT', countryCode: 'ES' },
        { name: 'Ceuta', code: 'CE', countryCode: 'ES' },
        { name: 'Extremadura', code: 'EX', countryCode: 'ES' },
        { name: 'Galicia', code: 'GA', countryCode: 'ES' },
        { name: 'La Rioja', code: 'RI', countryCode: 'ES' },
        { name: 'Madrid', code: 'MD', countryCode: 'ES' },
        { name: 'Melilla', code: 'ML', countryCode: 'ES' },
        { name: 'Murcia', code: 'MC', countryCode: 'ES' },
        { name: 'Navarre', code: 'NC', countryCode: 'ES' },
        { name: 'Valencian Community', code: 'VC', countryCode: 'ES' },
      ],
      'MX': [
        { name: 'Aguascalientes', code: 'AGU', countryCode: 'MX' },
        { name: 'Baja California', code: 'BCN', countryCode: 'MX' },
        { name: 'Baja California Sur', code: 'BCS', countryCode: 'MX' },
        { name: 'Campeche', code: 'CAM', countryCode: 'MX' },
        { name: 'Chiapas', code: 'CHP', countryCode: 'MX' },
        { name: 'Chihuahua', code: 'CHH', countryCode: 'MX' },
        { name: 'Coahuila', code: 'COA', countryCode: 'MX' },
        { name: 'Colima', code: 'COL', countryCode: 'MX' },
        { name: 'Durango', code: 'DUR', countryCode: 'MX' },
        { name: 'Guanajuato', code: 'GUA', countryCode: 'MX' },
        { name: 'Guerrero', code: 'GRO', countryCode: 'MX' },
        { name: 'Hidalgo', code: 'HID', countryCode: 'MX' },
        { name: 'Jalisco', code: 'JAL', countryCode: 'MX' },
        { name: 'Mexico City', code: 'CMX', countryCode: 'MX' },
        { name: 'Mexico State', code: 'MEX', countryCode: 'MX' },
        { name: 'Michoacán', code: 'MIC', countryCode: 'MX' },
        { name: 'Morelos', code: 'MOR', countryCode: 'MX' },
        { name: 'Nayarit', code: 'NAY', countryCode: 'MX' },
        { name: 'Nuevo León', code: 'NLE', countryCode: 'MX' },
        { name: 'Oaxaca', code: 'OAX', countryCode: 'MX' },
        { name: 'Puebla', code: 'PUE', countryCode: 'MX' },
        { name: 'Querétaro', code: 'QUE', countryCode: 'MX' },
        { name: 'Quintana Roo', code: 'ROO', countryCode: 'MX' },
        { name: 'San Luis Potosí', code: 'SLP', countryCode: 'MX' },
        { name: 'Sinaloa', code: 'SIN', countryCode: 'MX' },
        { name: 'Sonora', code: 'SON', countryCode: 'MX' },
        { name: 'Tabasco', code: 'TAB', countryCode: 'MX' },
        { name: 'Tamaulipas', code: 'TAM', countryCode: 'MX' },
        { name: 'Tlaxcala', code: 'TLA', countryCode: 'MX' },
        { name: 'Veracruz', code: 'VER', countryCode: 'MX' },
        { name: 'Yucatán', code: 'YUC', countryCode: 'MX' },
        { name: 'Zacatecas', code: 'ZAC', countryCode: 'MX' },
      ],
    };

    return staticStates[countryCode] || [];
};

export const clearLocationCache = () => {
  countriesCache = null;
  statesCache = {};
};
