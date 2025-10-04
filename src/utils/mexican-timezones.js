/**
 * Mexican Timezone Utilities
 * Maps phone area codes to timezones for accurate greetings
 */

// Area code to timezone mapping
const AREA_CODE_TIMEZONES = {
  // Northwest Zone (UTC-8) - Baja California
  '664': 'America/Tijuana',      // Tijuana
  '665': 'America/Tijuana',      // Mexicali  
  '646': 'America/Tijuana',      // Ensenada
  '661': 'America/Tijuana',      // Rosarito
  '686': 'America/Tijuana',      // Mexicali rural
  
  // Pacific Zone (UTC-7)
  // Baja California Sur
  '612': 'America/Mazatlan',     // La Paz
  '613': 'America/Mazatlan',     // Cabo San Lucas
  '615': 'America/Mazatlan',     // Ciudad Constitución
  
  // Sonora
  '644': 'America/Hermosillo',   // Hermosillo
  '622': 'America/Hermosillo',   // Guaymas
  '662': 'America/Hermosillo',   // Hermosillo
  '623': 'America/Hermosillo',   // San Luis Río Colorado
  '653': 'America/Hermosillo',   // Puerto Peñasco
  '631': 'America/Hermosillo',   // Nogales
  '642': 'America/Hermosillo',   // Navojoa
  '647': 'America/Hermosillo',   // Obregón
  
  // Sinaloa
  '668': 'America/Mazatlan',     // Mazatlán
  '669': 'America/Mazatlan',     // Mazatlán
  '667': 'America/Mazatlan',     // Culiacán
  '687': 'America/Mazatlan',     // Los Mochis
  '694': 'America/Mazatlan',     // Guasave
  
  // Nayarit
  '311': 'America/Mazatlan',     // Tepic
  '322': 'America/Mazatlan',     // Puerto Vallarta (part in Nayarit)
  '327': 'America/Mazatlan',     // Compostela
  
  // Chihuahua (most parts)
  '614': 'America/Chihuahua',    // Chihuahua
  '625': 'America/Chihuahua',    // Cuauhtémoc
  '628': 'America/Chihuahua',    // Parral
  '639': 'America/Chihuahua',    // Delicias
  '649': 'America/Chihuahua',    // Jiménez
  
  // Southeast Zone (UTC-5) - Quintana Roo
  '998': 'America/Cancun',       // Cancún
  '984': 'America/Cancun',       // Playa del Carmen
  '987': 'America/Cancun',       // Cozumel
  '983': 'America/Cancun',       // Chetumal
  '997': 'America/Cancun',       // Valladolid (close to QR border)
  
  // Central Zone (UTC-6) - Most populated areas
  // CDMX & Estado de México
  '55': 'America/Mexico_City',   // Ciudad de México
  '56': 'America/Mexico_City',   // Estado de México
  '722': 'America/Mexico_City',  // Toluca
  '729': 'America/Mexico_City',  // Nezahualcóyotl
  '595': 'America/Mexico_City',  // Atlacomulco
  
  // Jalisco
  '33': 'America/Mexico_City',   // Guadalajara
  '333': 'America/Mexico_City',  // Guadalajara
  '341': 'America/Mexico_City',  // Tapalpa
  '342': 'America/Mexico_City',  // Tepatitlán
  '343': 'America/Mexico_City',  // Ocotlán
  '344': 'America/Mexico_City',  // San Juan de los Lagos
  '345': 'America/Mexico_City',  // Lagos de Moreno
  '348': 'America/Mexico_City',  // Arandas
  '349': 'America/Mexico_City',  // Zapotlanejo
  '354': 'America/Mexico_City',  // Colotlán
  '357': 'America/Mexico_City',  // Autlán
  '371': 'America/Mexico_City',  // El Grullo
  '372': 'America/Mexico_City',  // Sayula
  '373': 'America/Mexico_City',  // Ameca
  '374': 'America/Mexico_City',  // San Martín Hidalgo
  '375': 'America/Mexico_City',  // Tala
  '376': 'America/Mexico_City',  // Atotonilco
  '377': 'America/Mexico_City',  // Teocaltiche
  '378': 'America/Mexico_City',  // La Barca
  '382': 'America/Mexico_City',  // Zapotiltic
  '384': 'America/Mexico_City',  // Cihuatlán
  '385': 'America/Mexico_City',  // Tamazula
  '386': 'America/Mexico_City',  // Mascota
  '387': 'America/Mexico_City',  // Talpa
  '388': 'America/Mexico_City',  // Puerto Vallarta (part in Jalisco)
  '391': 'America/Mexico_City',  // Poncitlán
  '392': 'America/Mexico_City',  // Chapala
  '393': 'America/Mexico_City',  // Jocotepec
  '395': 'America/Mexico_City',  // Tizapán
  
  // Nuevo León
  '81': 'America/Mexico_City',   // Monterrey
  '811': 'America/Mexico_City',  // Monterrey
  '812': 'America/Mexico_City',  // Monterrey
  '818': 'America/Mexico_City',  // Monterrey
  '821': 'America/Mexico_City',  // Linares
  '823': 'America/Mexico_City',  // Sabinas Hidalgo
  '824': 'America/Mexico_City',  // Montemorelos
  '825': 'America/Mexico_City',  // General Terán
  '826': 'America/Mexico_City',  // Santiago
  '828': 'America/Mexico_City',  // Cadereyta
  '829': 'America/Mexico_City',  // China
  '867': 'America/Mexico_City',  // Anáhuac
  '873': 'America/Mexico_City',  // Doctor Arroyo
  '892': 'America/Mexico_City',  // Cerralvo
  
  // Guanajuato
  '461': 'America/Mexico_City',  // Celaya
  '462': 'America/Mexico_City',  // Irapuato  
  '464': 'America/Mexico_City',  // Salamanca
  '466': 'America/Mexico_City',  // Valle de Santiago
  '468': 'America/Mexico_City',  // Pénjamo
  '469': 'America/Mexico_City',  // Abasolo
  '472': 'America/Mexico_City',  // Cortazar
  '473': 'America/Mexico_City',  // Guanajuato
  '476': 'America/Mexico_City',  // Silao
  '477': 'America/Mexico_City',  // León
  '479': 'America/Mexico_City',  // San Francisco del Rincón
  
  // Puebla
  '222': 'America/Mexico_City',  // Puebla
  '223': 'America/Mexico_City',  // Tehuacán
  '224': 'America/Mexico_City',  // Atlixco
  '226': 'America/Mexico_City',  // Ajalpan
  '227': 'America/Mexico_City',  // Teziutlán
  '231': 'America/Mexico_City',  // Zacatlán
  '232': 'America/Mexico_City',  // Tlatlauquitepec
  '233': 'America/Mexico_City',  // Zacapoaxtla
  '236': 'America/Mexico_City',  // Ciudad Serdán
  '237': 'America/Mexico_City',  // Tecamachalco
  '238': 'America/Mexico_City',  // Tehuacán
  '243': 'America/Mexico_City',  // Cholula
  '244': 'America/Mexico_City',  // Izúcar de Matamoros
  '245': 'America/Mexico_City',  // Acatlán
  '248': 'America/Mexico_City',  // Cuetzalan
  '249': 'America/Mexico_City',  // Tepeaca
  '273': 'America/Mexico_City',  // Tlachichuca
  '275': 'America/Mexico_City',  // Tepexi
  '276': 'America/Mexico_City',  // Libres
  '278': 'America/Mexico_City',  // Coxcatlán
  '282': 'America/Mexico_City',  // Xicotepec
  '746': 'America/Mexico_City',  // Chignahuapan
  '764': 'America/Mexico_City',  // Huauchinango
  '776': 'America/Mexico_City',  // Venustiano Carranza
  '797': 'America/Mexico_City',  // Tetela de Ocampo
  
  // Veracruz
  '229': 'America/Mexico_City',  // Veracruz
  '271': 'America/Mexico_City',  // Poza Rica
  '272': 'America/Mexico_City',  // Córdoba
  '273': 'America/Mexico_City',  // Fortín
  '274': 'America/Mexico_City',  // Cosamaloapan
  '278': 'America/Mexico_City',  // Orizaba
  '279': 'America/Mexico_City',  // San Andrés Tuxtla
  '281': 'America/Mexico_City',  // Acayucan
  '282': 'America/Mexico_City',  // Jáltipan
  '283': 'America/Mexico_City',  // Coatzacoalcos
  '284': 'America/Mexico_City',  // Agua Dulce
  '285': 'America/Mexico_City',  // Tlacotalpan
  '287': 'America/Mexico_City',  // Isla
  '288': 'America/Mexico_City',  // Alvarado
  '294': 'America/Mexico_City',  // Santiago Tuxtla
  '296': 'America/Mexico_City',  // Boca del Río
  '297': 'America/Mexico_City',  // Medellín
  
  // Michoacán
  '443': 'America/Mexico_City',  // Morelia
  '351': 'America/Mexico_City',  // Zamora
  '352': 'America/Mexico_City',  // Uruapan
  '353': 'America/Mexico_City',  // Sahuayo
  '354': 'America/Mexico_City',  // Zacapu
  '355': 'America/Mexico_City',  // Jiquilpan
  '356': 'America/Mexico_City',  // La Piedad
  '359': 'America/Mexico_City',  // Cotija
  '381': 'America/Mexico_City',  // Apatzingán
  '383': 'America/Mexico_City',  // Pátzcuaro
  '393': 'America/Mexico_City',  // Nueva Italia
  '394': 'America/Mexico_City',  // Paracho
  '421': 'America/Mexico_City',  // Jacona
  '422': 'America/Mexico_City',  // Tepalcatepec
  '423': 'America/Mexico_City',  // Tancítaro
  '424': 'America/Mexico_City',  // Coalcomán
  '425': 'America/Mexico_City',  // Aguililla
  '426': 'America/Mexico_City',  // Arteaga
  '434': 'America/Mexico_City',  // Quiroga
  '435': 'America/Mexico_City',  // Cherán
  '436': 'America/Mexico_City',  // Aquila
  '438': 'America/Mexico_City',  // Puruándiro
  '447': 'America/Mexico_City',  // Cd. Hidalgo
  '451': 'America/Mexico_City',  // Zitácuaro
  '452': 'America/Mexico_City',  // Nahuatzen
  '453': 'America/Mexico_City',  // Paracho
  '454': 'America/Mexico_City',  // Zinapécuaro
  '455': 'America/Mexico_City',  // Tacámbaro
  '459': 'America/Mexico_City',  // Ario de Rosales
  '471': 'America/Mexico_City',  // Maravatío
  '515': 'America/Mexico_City',  // Contepec
  '534': 'America/Mexico_City',  // Erongarícuaro
  '535': 'America/Mexico_City',  // Chilchota
  '584': 'America/Mexico_City',  // Senguio
  '588': 'America/Mexico_City',  // Tlalpujahua
  '593': 'America/Mexico_City',  // Angangueo
  '596': 'America/Mexico_City',  // Epitacio Huerta
  '613': 'America/Mexico_City',  // Huetamo
  '689': 'America/Mexico_City',  // Tanhuato
  '711': 'America/Mexico_City',  // Ocampo
  '715': 'America/Mexico_City',  // Tuxpan
  '725': 'America/Mexico_City',  // Tuzantla
  '753': 'America/Mexico_City',  // Lázaro Cárdenas
  '767': 'America/Mexico_City',  // San Lucas
  '769': 'America/Mexico_City',  // Nocupétaro
  '784': 'America/Mexico_City',  // Coeneo
  '785': 'America/Mexico_City',  // Tzintzuntzan
  '786': 'America/Mexico_City',  // Huaniqueo
  
  // Querétaro
  '442': 'America/Mexico_City',  // Querétaro
  '414': 'America/Mexico_City',  // Tequisquiapan
  '419': 'America/Mexico_City',  // El Marqués
  '427': 'America/Mexico_City',  // San Juan del Río
  '441': 'America/Mexico_City',  // Jalpan
  '446': 'America/Mexico_City',  // Querétaro
  '448': 'America/Mexico_City',  // Cadereyta
  '487': 'America/Mexico_City',  // Pinal de Amoles
  
  // Coahuila
  '844': 'America/Mexico_City',  // Saltillo
  '861': 'America/Mexico_City',  // Torreón
  '862': 'America/Mexico_City',  // Monclova
  '864': 'America/Mexico_City',  // Sabinas
  '866': 'America/Mexico_City',  // Frontera
  '869': 'America/Mexico_City',  // Matamoros
  '871': 'America/Mexico_City',  // Torreón
  '872': 'America/Mexico_City',  // Gómez Palacio
  '877': 'America/Mexico_City',  // Piedras Negras
  '878': 'America/Mexico_City',  // Nueva Rosita
  
  // Chiapas
  '961': 'America/Mexico_City',  // Tuxtla Gutiérrez
  '962': 'America/Mexico_City',  // Tapachula
  '963': 'America/Mexico_City',  // Comitán
  '964': 'America/Mexico_City',  // Villaflores
  '965': 'America/Mexico_City',  // Tonalá
  '966': 'America/Mexico_City',  // Huixtla
  '967': 'America/Mexico_City',  // San Cristóbal
  '968': 'America/Mexico_City',  // Ocosingo
  '916': 'America/Mexico_City',  // Palenque
  '919': 'America/Mexico_City',  // Las Margaritas
  '932': 'America/Mexico_City',  // Pichucalco
  '934': 'America/Mexico_City',  // Yajalón
  
  // Oaxaca
  '951': 'America/Mexico_City',  // Oaxaca
  '953': 'America/Mexico_City',  // Tlaxiaco
  '954': 'America/Mexico_City',  // Huajuapan
  '958': 'America/Mexico_City',  // Tehuantepec
  '971': 'America/Mexico_City',  // Salina Cruz
  '972': 'America/Mexico_City',  // Juchitán
  '994': 'America/Mexico_City',  // Ixtepec
  '995': 'America/Mexico_City',  // Pinotepa Nacional
  
  // Guerrero
  '744': 'America/Mexico_City',  // Acapulco
  '745': 'America/Mexico_City',  // Iguala
  '747': 'America/Mexico_City',  // Chilpancingo
  '754': 'America/Mexico_City',  // Chilapa
  '755': 'America/Mexico_City',  // Taxco
  '756': 'America/Mexico_City',  // Tlapa
  '757': 'America/Mexico_City',  // Ometepec
  '758': 'America/Mexico_City',  // Zihuatanejo
  '762': 'America/Mexico_City',  // Teloloapan
  '767': 'America/Mexico_City',  // Arcelia
  '781': 'America/Mexico_City',  // Atoyac
  
  // Yucatán
  '999': 'America/Mexico_City',  // Mérida
  '985': 'America/Mexico_City',  // Progreso
  '986': 'America/Mexico_City',  // Valladolid
  '988': 'America/Mexico_City',  // Ticul
  '990': 'America/Mexico_City',  // Motul
  '991': 'America/Mexico_City',  // Tizimín
  '997': 'America/Mexico_City',  // Valladolid
  
  // Tamaulipas
  '834': 'America/Mexico_City',  // Tampico
  '867': 'America/Mexico_City',  // Nuevo Laredo
  '868': 'America/Mexico_City',  // Matamoros
  '899': 'America/Mexico_City',  // Reynosa
  '831': 'America/Mexico_City',  // Río Bravo
  '832': 'America/Mexico_City',  // González
  '833': 'America/Mexico_City',  // Altamira
  '835': 'America/Mexico_City',  // Mante
  '836': 'America/Mexico_City',  // Ciudad Victoria
  '841': 'America/Mexico_City',  // Abasolo
  '894': 'America/Mexico_City',  // San Fernando
  '897': 'America/Mexico_City',  // Valle Hermoso
  
  // San Luis Potosí
  '444': 'America/Mexico_City',  // San Luis Potosí
  '481': 'America/Mexico_City',  // Rioverde
  '482': 'America/Mexico_City',  // Tamazunchale
  '483': 'America/Mexico_City',  // Xilitla
  '485': 'America/Mexico_City',  // Ciudad Valles
  '486': 'America/Mexico_City',  // Salinas
  '487': 'America/Mexico_City',  // Cárdenas
  '488': 'America/Mexico_City',  // Matehuala
  '489': 'America/Mexico_City',  // Tamuín
  '496': 'America/Mexico_City',  // Charcas
  
  // Durango
  '618': 'America/Mexico_City',  // Durango
  '629': 'America/Mexico_City',  // Guadalupe Victoria
  '649': 'America/Mexico_City',  // Mezquital
  '671': 'America/Mexico_City',  // Santiago Papasquiaro
  '674': 'America/Mexico_City',  // El Salto
  '675': 'America/Mexico_City',  // Nuevo Ideal
  '676': 'America/Mexico_City',  // Canatlán
  '677': 'America/Mexico_City',  // Vicente Guerrero
  
  // Hidalgo
  '771': 'America/Mexico_City',  // Pachuca
  '738': 'America/Mexico_City',  // Tepeapulco
  '743': 'America/Mexico_City',  // Apan
  '748': 'America/Mexico_City',  // Tlaxcoapan
  '759': 'America/Mexico_City',  // Actopan
  '761': 'America/Mexico_City',  // Atotonilco
  '763': 'America/Mexico_City',  // Tepeji
  '772': 'America/Mexico_City',  // Tulancingo
  '773': 'America/Mexico_City',  // Tizayuca
  '774': 'America/Mexico_City',  // Ixmiquilpan
  '775': 'America/Mexico_City',  // Huejutla
  '778': 'America/Mexico_City',  // Tula
  '779': 'America/Mexico_City',  // Tepeapulco
  '789': 'America/Mexico_City',  // Huichapan
  '791': 'America/Mexico_City',  // Tecozautla
  
  // Morelos
  '777': 'America/Mexico_City',  // Cuernavaca
  '731': 'America/Mexico_City',  // Cuautla
  '734': 'America/Mexico_City',  // Jojutla
  '735': 'America/Mexico_City',  // Yautepec
  '737': 'America/Mexico_City',  // Jonacatepec
  '739': 'America/Mexico_City',  // Jiutepec
  '751': 'America/Mexico_City',  // Zacatepec
  '769': 'America/Mexico_City',  // Tepalcingo
  
  // Aguascalientes
  '449': 'America/Mexico_City',  // Aguascalientes
  '465': 'America/Mexico_City',  // Jesús María
  '495': 'America/Mexico_City',  // Calvillo
  
  // Colima
  '312': 'America/Mexico_City',  // Colima
  '313': 'America/Mexico_City',  // Manzanillo
  '314': 'America/Mexico_City',  // Tecomán
  
  // Tlaxcala
  '246': 'America/Mexico_City',  // Tlaxcala
  '241': 'America/Mexico_City',  // Apizaco
  '247': 'America/Mexico_City',  // Huamantla
  '248': 'America/Mexico_City',  // Calpulalpan
  '249': 'America/Mexico_City',  // Zacatelco
  '276': 'America/Mexico_City',  // Tlaxco
  
  // Zacatecas
  '492': 'America/Mexico_City',  // Zacatecas
  '433': 'America/Mexico_City',  // Nochistlán
  '437': 'America/Mexico_City',  // Juchipila
  '457': 'America/Mexico_City',  // Juan Aldama
  '458': 'America/Mexico_City',  // Río Grande
  '463': 'America/Mexico_City',  // Tlaltenango
  '467': 'America/Mexico_City',  // Jerez
  '478': 'America/Mexico_City',  // Loreto
  '493': 'America/Mexico_City',  // Fresnillo
  '494': 'America/Mexico_City',  // Guadalupe
  '496': 'America/Mexico_City',  // Sombrerete
  '498': 'America/Mexico_City',  // Ojocaliente
  '499': 'America/Mexico_City',  // Jalpa
  '842': 'America/Mexico_City',  // Valparaíso
  
  // Campeche
  '981': 'America/Mexico_City',  // Campeche
  '982': 'America/Mexico_City',  // Ciudad del Carmen
  '996': 'America/Mexico_City',  // Champotón
  
  // Tabasco
  '993': 'America/Mexico_City',  // Villahermosa
  '913': 'America/Mexico_City',  // Teapa
  '914': 'America/Mexico_City',  // Frontera
  '917': 'America/Mexico_City',  // Cárdenas
  '923': 'America/Mexico_City',  // Emiliano Zapata
  '933': 'America/Mexico_City',  // Huimanguillo
  '934': 'America/Mexico_City',  // Balancán
  '936': 'America/Mexico_City',  // Paraíso
  '937': 'America/Mexico_City',  // Tenosique
  '992': 'America/Mexico_City',  // Jalpa de Méndez
  '994': 'America/Mexico_City',  // Nacajuca
};

/**
 * Extract area code from Mexican phone number
 * @param {string} phoneNumber - Phone number in format 521234567890 or 5212341234567
 * @returns {string|null} Area code or null if not found
 */
function extractAreaCode(phoneNumber) {
  // Remove any non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Remove country code (52)
  let numberWithoutCountry = cleaned;
  if (cleaned.startsWith('52')) {
    numberWithoutCountry = cleaned.substring(2);
  }
  
  // Remove possible '1' prefix for mobile
  if (numberWithoutCountry.startsWith('1') && numberWithoutCountry.length > 10) {
    numberWithoutCountry = numberWithoutCountry.substring(1);
  }
  
  // Try to match area codes (2-3 digits)
  // First try 3-digit codes
  const threeDigit = numberWithoutCountry.substring(0, 3);
  if (AREA_CODE_TIMEZONES[threeDigit]) {
    return threeDigit;
  }
  
  // Then try 2-digit codes
  const twoDigit = numberWithoutCountry.substring(0, 2);
  if (AREA_CODE_TIMEZONES[twoDigit]) {
    return twoDigit;
  }
  
  return null;
}

/**
 * Get timezone for Mexican phone number
 * @param {string} phoneNumber - Phone number
 * @returns {string} Timezone identifier (defaults to Mexico City)
 */
function getTimezoneForPhone(phoneNumber) {
  const areaCode = extractAreaCode(phoneNumber);
  return AREA_CODE_TIMEZONES[areaCode] || 'America/Mexico_City';
}

/**
 * Get appropriate greeting based on phone number's timezone
 * @param {string} phoneNumber - Phone number
 * @returns {string} Time-appropriate greeting
 */
function getGreeting(phoneNumber) {
  const timezone = getTimezoneForPhone(phoneNumber);
  
  // Get current time in the user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false
  });
  
  const localTime = formatter.format(now);
  const hour = parseInt(localTime);
  
  // Mexican greeting conventions
  if (hour >= 5 && hour < 12) {
    return 'Buenos días';
  } else if (hour >= 12 && hour < 19) {
    return 'Buenas tardes';
  } else {
    return 'Buenas noches';
  }
}

/**
 * Get timezone name for display
 * @param {string} phoneNumber - Phone number
 * @returns {string} Human-readable timezone name
 */
function getTimezoneName(phoneNumber) {
  const timezone = getTimezoneForPhone(phoneNumber);
  
  const zoneNames = {
    'America/Tijuana': 'Zona Noroeste',
    'America/Mazatlan': 'Zona Pacífico',
    'America/Hermosillo': 'Zona Pacífico',
    'America/Chihuahua': 'Zona Pacífico',
    'America/Mexico_City': 'Zona Centro',
    'America/Cancun': 'Zona Sureste'
  };
  
  return zoneNames[timezone] || 'Zona Centro';
}

/**
 * Get state name from area code
 * @param {string} areaCode - Area code
 * @returns {string|null} State name or null
 */
function getStateFromAreaCode(areaCode) {
  // Simplified mapping of major area codes to states
  const areaCodeStates = {
    // Baja California
    '664': 'Baja California', '665': 'Baja California', '646': 'Baja California',
    
    // Baja California Sur
    '612': 'Baja California Sur', '613': 'Baja California Sur',
    
    // Sonora
    '644': 'Sonora', '622': 'Sonora', '662': 'Sonora',
    
    // Quintana Roo
    '998': 'Quintana Roo', '984': 'Quintana Roo', '987': 'Quintana Roo',
    
    // CDMX
    '55': 'Ciudad de México', '56': 'Estado de México',
    
    // Jalisco
    '33': 'Jalisco', '333': 'Jalisco',
    
    // Nuevo León
    '81': 'Nuevo León', '811': 'Nuevo León',
    
    // Add more as needed...
  };
  
  return areaCodeStates[areaCode] || null;
}

module.exports = {
  extractAreaCode,
  getTimezoneForPhone,
  getGreeting,
  getTimezoneName,
  getStateFromAreaCode,
  AREA_CODE_TIMEZONES
};