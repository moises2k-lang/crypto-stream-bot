// Map countries to languages
const countryToLanguage: { [key: string]: string } = {
  // Spanish speaking countries
  ES: 'es', AR: 'es', MX: 'es', CO: 'es', PE: 'es', VE: 'es', CL: 'es', 
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', GQ: 'es',
  
  // Portuguese speaking countries
  BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt', GW: 'pt', TL: 'pt', 
  MO: 'pt', CV: 'pt', ST: 'pt',
  
  // English speaking countries (and default)
  US: 'en', GB: 'en', CA: 'en', AU: 'en', NZ: 'en', IE: 'en',
  ZA: 'en', IN: 'en', PK: 'en', NG: 'en', PH: 'en', SG: 'en',
};

export const detectLanguageByCountry = async (): Promise<string | null> => {
  try {
    // Try to get country from IP using ipapi.co (free, no key required)
    const response = await fetch('https://ipapi.co/json/');
    
    if (!response.ok) {
      console.warn('Failed to detect country from IP');
      return null;
    }
    
    const data = await response.json();
    const countryCode = data.country_code;
    
    if (countryCode) {
      console.log('Detected country:', countryCode);
      const language = countryToLanguage[countryCode] || 'en';
      console.log('Selected language:', language);
      return language;
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting country:', error);
    return null;
  }
};
