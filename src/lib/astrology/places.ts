/**
 * Where somebody was born, to the nearest big city.
 *
 * ── Why a bundled list and not a search service ─────────────────────────────
 *
 * Because the alternative is sending the name of the town somebody was born in
 * to a geocoding API, and this app's whole argument is that nothing it is told
 * leaves the device. A birth date, a birth time and a birthplace are, together,
 * about as identifying as a person's information gets. Shipping a couple of
 * hundred cities in the bundle costs around twelve kilobytes, which is less
 * than one of the icons.
 *
 * ── Why to the nearest big city is enough ───────────────────────────────────
 *
 * Latitude is what the Ascendant needs, and it needs it loosely: at a typical
 * latitude, a hundred kilometres of north–south error moves the Ascendant by
 * well under a degree. Longitude matters more — it is the local sidereal time,
 * four minutes of clock per degree — but a hundred kilometres east or west is
 * about a degree, which again is a quarter of the error in a birth time
 * anybody actually remembers.
 *
 * What the city really carries is the *time zone*, and there the nearest large
 * city is not an approximation at all: it is exactly right, because time zones
 * are drawn around cities.
 *
 * Anyone whose birthplace is genuinely nowhere near any of these can enter a
 * latitude and longitude directly, which is the escape hatch every list like
 * this needs and most do not have.
 */

export interface Place {
  name: string
  country: string
  latitude: number
  /** East positive, which is the convention the sidereal maths expects. */
  longitude: number
  timeZone: string
}

/**
 * `name|country|lat|lon|zone`, parsed once at module load.
 *
 * A packed string rather than an array of objects because the same two hundred
 * entries cost about a third as much to ship this way, and this list only
 * exists in the bundle at all for people who use the astrology feature.
 */
const PACKED = [
  'London|United Kingdom|51.5074|-0.1278|Europe/London',
  'Manchester|United Kingdom|53.4808|-2.2426|Europe/London',
  'Birmingham|United Kingdom|52.4862|-1.8904|Europe/London',
  'Glasgow|United Kingdom|55.8642|-4.2518|Europe/London',
  'Edinburgh|United Kingdom|55.9533|-3.1883|Europe/London',
  'Dublin|Ireland|53.3498|-6.2603|Europe/Dublin',
  'Paris|France|48.8566|2.3522|Europe/Paris',
  'Marseille|France|43.2965|5.3698|Europe/Paris',
  'Lyon|France|45.7640|4.8357|Europe/Paris',
  'Madrid|Spain|40.4168|-3.7038|Europe/Madrid',
  'Barcelona|Spain|41.3874|2.1686|Europe/Madrid',
  'Valencia|Spain|39.4699|-0.3763|Europe/Madrid',
  'Lisbon|Portugal|38.7223|-9.1393|Europe/Lisbon',
  'Porto|Portugal|41.1579|-8.6291|Europe/Lisbon',
  'Rome|Italy|41.9028|12.4964|Europe/Rome',
  'Milan|Italy|45.4642|9.1900|Europe/Rome',
  'Naples|Italy|40.8518|14.2681|Europe/Rome',
  'Berlin|Germany|52.5200|13.4050|Europe/Berlin',
  'Munich|Germany|48.1351|11.5820|Europe/Berlin',
  'Hamburg|Germany|53.5511|9.9937|Europe/Berlin',
  'Cologne|Germany|50.9375|6.9603|Europe/Berlin',
  'Frankfurt|Germany|50.1109|8.6821|Europe/Berlin',
  'Vienna|Austria|48.2082|16.3738|Europe/Vienna',
  'Zurich|Switzerland|47.3769|8.5417|Europe/Zurich',
  'Geneva|Switzerland|46.2044|6.1432|Europe/Zurich',
  'Amsterdam|Netherlands|52.3676|4.9041|Europe/Amsterdam',
  'Rotterdam|Netherlands|51.9244|4.4777|Europe/Amsterdam',
  'Brussels|Belgium|50.8503|4.3517|Europe/Brussels',
  'Copenhagen|Denmark|55.6761|12.5683|Europe/Copenhagen',
  'Oslo|Norway|59.9139|10.7522|Europe/Oslo',
  'Stockholm|Sweden|59.3293|18.0686|Europe/Stockholm',
  'Gothenburg|Sweden|57.7089|11.9746|Europe/Stockholm',
  'Helsinki|Finland|60.1699|24.9384|Europe/Helsinki',
  'Reykjavik|Iceland|64.1466|-21.9426|Atlantic/Reykjavik',
  'Warsaw|Poland|52.2297|21.0122|Europe/Warsaw',
  'Krakow|Poland|50.0647|19.9450|Europe/Warsaw',
  'Prague|Czechia|50.0755|14.4378|Europe/Prague',
  'Budapest|Hungary|47.4979|19.0402|Europe/Budapest',
  'Bucharest|Romania|44.4268|26.1025|Europe/Bucharest',
  'Sofia|Bulgaria|42.6977|23.3219|Europe/Sofia',
  'Belgrade|Serbia|44.7866|20.4489|Europe/Belgrade',
  'Zagreb|Croatia|45.8150|15.9819|Europe/Zagreb',
  'Athens|Greece|37.9838|23.7275|Europe/Athens',
  'Istanbul|Turkey|41.0082|28.9784|Europe/Istanbul',
  'Ankara|Turkey|39.9334|32.8597|Europe/Istanbul',
  'Kyiv|Ukraine|50.4501|30.5234|Europe/Kyiv',
  'Moscow|Russia|55.7558|37.6173|Europe/Moscow',
  'Saint Petersburg|Russia|59.9311|30.3609|Europe/Moscow',
  'Riga|Latvia|56.9496|24.1052|Europe/Riga',
  'Vilnius|Lithuania|54.6872|25.2797|Europe/Vilnius',
  'Tallinn|Estonia|59.4370|24.7536|Europe/Tallinn',

  'New York|United States|40.7128|-74.0060|America/New_York',
  'Brooklyn|United States|40.6782|-73.9442|America/New_York',
  'Boston|United States|42.3601|-71.0589|America/New_York',
  'Philadelphia|United States|39.9526|-75.1652|America/New_York',
  'Washington|United States|38.9072|-77.0369|America/New_York',
  'Baltimore|United States|39.2904|-76.6122|America/New_York',
  'Atlanta|United States|33.7490|-84.3880|America/New_York',
  'Miami|United States|25.7617|-80.1918|America/New_York',
  'Orlando|United States|28.5383|-81.3792|America/New_York',
  'Tampa|United States|27.9506|-82.4572|America/New_York',
  'Charlotte|United States|35.2271|-80.8431|America/New_York',
  'Detroit|United States|42.3314|-83.0458|America/New_York',
  'Pittsburgh|United States|40.4406|-79.9959|America/New_York',
  'Cleveland|United States|41.4993|-81.6944|America/New_York',
  'Columbus|United States|39.9612|-82.9988|America/New_York',
  'Indianapolis|United States|39.7684|-86.1581|America/Indiana/Indianapolis',
  'Chicago|United States|41.8781|-87.6298|America/Chicago',
  'Houston|United States|29.7604|-95.3698|America/Chicago',
  'Dallas|United States|32.7767|-96.7970|America/Chicago',
  'Austin|United States|30.2672|-97.7431|America/Chicago',
  'San Antonio|United States|29.4241|-98.4936|America/Chicago',
  'Minneapolis|United States|44.9778|-93.2650|America/Chicago',
  'Kansas City|United States|39.0997|-94.5786|America/Chicago',
  'St. Louis|United States|38.6270|-90.1994|America/Chicago',
  'New Orleans|United States|29.9511|-90.0715|America/Chicago',
  'Nashville|United States|36.1627|-86.7816|America/Chicago',
  'Memphis|United States|35.1495|-90.0490|America/Chicago',
  'Milwaukee|United States|43.0389|-87.9065|America/Chicago',
  'Oklahoma City|United States|35.4676|-97.5164|America/Chicago',
  'Denver|United States|39.7392|-104.9903|America/Denver',
  'Salt Lake City|United States|40.7608|-111.8910|America/Denver',
  'Albuquerque|United States|35.0844|-106.6504|America/Denver',
  'Phoenix|United States|33.4484|-112.0740|America/Phoenix',
  'Las Vegas|United States|36.1699|-115.1398|America/Los_Angeles',
  'Los Angeles|United States|34.0522|-118.2437|America/Los_Angeles',
  'San Diego|United States|32.7157|-117.1611|America/Los_Angeles',
  'San Francisco|United States|37.7749|-122.4194|America/Los_Angeles',
  'San Jose|United States|37.3382|-121.8863|America/Los_Angeles',
  'Sacramento|United States|38.5816|-121.4944|America/Los_Angeles',
  'Portland|United States|45.5152|-122.6784|America/Los_Angeles',
  'Seattle|United States|47.6062|-122.3321|America/Los_Angeles',
  'Anchorage|United States|61.2181|-149.9003|America/Anchorage',
  'Honolulu|United States|21.3069|-157.8583|Pacific/Honolulu',
  'Toronto|Canada|43.6532|-79.3832|America/Toronto',
  'Ottawa|Canada|45.4215|-75.6972|America/Toronto',
  'Montreal|Canada|45.5017|-73.5673|America/Toronto',
  'Quebec City|Canada|46.8139|-71.2080|America/Toronto',
  'Winnipeg|Canada|49.8951|-97.1384|America/Winnipeg',
  'Calgary|Canada|51.0447|-114.0719|America/Edmonton',
  'Edmonton|Canada|53.5461|-113.4938|America/Edmonton',
  'Vancouver|Canada|49.2827|-123.1207|America/Vancouver',
  'Halifax|Canada|44.6488|-63.5752|America/Halifax',
  'Mexico City|Mexico|19.4326|-99.1332|America/Mexico_City',
  'Guadalajara|Mexico|20.6597|-103.3496|America/Mexico_City',
  'Monterrey|Mexico|25.6866|-100.3161|America/Monterrey',
  'Tijuana|Mexico|32.5149|-117.0382|America/Tijuana',
  'Havana|Cuba|23.1136|-82.3666|America/Havana',
  'Kingston|Jamaica|17.9714|-76.7931|America/Jamaica',
  'San Juan|Puerto Rico|18.4655|-66.1057|America/Puerto_Rico',
  'Santo Domingo|Dominican Republic|18.4861|-69.9312|America/Santo_Domingo',
  'Panama City|Panama|8.9824|-79.5199|America/Panama',
  'San Jose|Costa Rica|9.9281|-84.0907|America/Costa_Rica',
  'Guatemala City|Guatemala|14.6349|-90.5069|America/Guatemala',
  'Bogota|Colombia|4.7110|-74.0721|America/Bogota',
  'Medellin|Colombia|6.2442|-75.5812|America/Bogota',
  'Caracas|Venezuela|10.4806|-66.9036|America/Caracas',
  'Quito|Ecuador|-0.1807|-78.4678|America/Guayaquil',
  'Lima|Peru|-12.0464|-77.0428|America/Lima',
  'La Paz|Bolivia|-16.4897|-68.1193|America/La_Paz',
  'Santiago|Chile|-33.4489|-70.6693|America/Santiago',
  'Buenos Aires|Argentina|-34.6037|-58.3816|America/Argentina/Buenos_Aires',
  'Cordoba|Argentina|-31.4201|-64.1888|America/Argentina/Cordoba',
  'Montevideo|Uruguay|-34.9011|-56.1645|America/Montevideo',
  'Asuncion|Paraguay|-25.2637|-57.5759|America/Asuncion',
  'Sao Paulo|Brazil|-23.5505|-46.6333|America/Sao_Paulo',
  'Rio de Janeiro|Brazil|-22.9068|-43.1729|America/Sao_Paulo',
  'Brasilia|Brazil|-15.7939|-47.8828|America/Sao_Paulo',
  'Salvador|Brazil|-12.9777|-38.5016|America/Bahia',
  'Fortaleza|Brazil|-3.7319|-38.5267|America/Fortaleza',
  'Recife|Brazil|-8.0476|-34.8770|America/Recife',
  'Porto Alegre|Brazil|-30.0346|-51.2177|America/Sao_Paulo',
  'Manaus|Brazil|-3.1190|-60.0217|America/Manaus',

  'Cairo|Egypt|30.0444|31.2357|Africa/Cairo',
  'Alexandria|Egypt|31.2001|29.9187|Africa/Cairo',
  'Casablanca|Morocco|33.5731|-7.5898|Africa/Casablanca',
  'Rabat|Morocco|34.0209|-6.8416|Africa/Casablanca',
  'Algiers|Algeria|36.7538|3.0588|Africa/Algiers',
  'Tunis|Tunisia|36.8065|10.1815|Africa/Tunis',
  'Tripoli|Libya|32.8872|13.1913|Africa/Tripoli',
  'Khartoum|Sudan|15.5007|32.5599|Africa/Khartoum',
  'Addis Ababa|Ethiopia|9.0300|38.7400|Africa/Addis_Ababa',
  'Nairobi|Kenya|-1.2921|36.8219|Africa/Nairobi',
  'Kampala|Uganda|0.3476|32.5825|Africa/Kampala',
  'Dar es Salaam|Tanzania|-6.7924|39.2083|Africa/Dar_es_Salaam',
  'Kigali|Rwanda|-1.9441|30.0619|Africa/Kigali',
  'Lagos|Nigeria|6.5244|3.3792|Africa/Lagos',
  'Abuja|Nigeria|9.0765|7.3986|Africa/Lagos',
  'Accra|Ghana|5.6037|-0.1870|Africa/Accra',
  'Abidjan|Ivory Coast|5.3600|-4.0083|Africa/Abidjan',
  'Dakar|Senegal|14.7167|-17.4677|Africa/Dakar',
  'Kinshasa|DR Congo|-4.4419|15.2663|Africa/Kinshasa',
  'Luanda|Angola|-8.8390|13.2894|Africa/Luanda',
  'Harare|Zimbabwe|-17.8252|31.0335|Africa/Harare',
  'Lusaka|Zambia|-15.3875|28.3228|Africa/Lusaka',
  'Johannesburg|South Africa|-26.2041|28.0473|Africa/Johannesburg',
  'Cape Town|South Africa|-33.9249|18.4241|Africa/Johannesburg',
  'Durban|South Africa|-29.8587|31.0218|Africa/Johannesburg',
  'Pretoria|South Africa|-25.7479|28.2293|Africa/Johannesburg',

  'Tel Aviv|Israel|32.0853|34.7818|Asia/Jerusalem',
  'Jerusalem|Israel|31.7683|35.2137|Asia/Jerusalem',
  'Beirut|Lebanon|33.8938|35.5018|Asia/Beirut',
  'Amman|Jordan|31.9454|35.9284|Asia/Amman',
  'Damascus|Syria|33.5138|36.2765|Asia/Damascus',
  'Baghdad|Iraq|33.3152|44.3661|Asia/Baghdad',
  'Riyadh|Saudi Arabia|24.7136|46.6753|Asia/Riyadh',
  'Jeddah|Saudi Arabia|21.4858|39.1925|Asia/Riyadh',
  'Dubai|United Arab Emirates|25.2048|55.2708|Asia/Dubai',
  'Abu Dhabi|United Arab Emirates|24.4539|54.3773|Asia/Dubai',
  'Doha|Qatar|25.2854|51.5310|Asia/Qatar',
  'Kuwait City|Kuwait|29.3759|47.9774|Asia/Kuwait',
  'Muscat|Oman|23.5880|58.3829|Asia/Muscat',
  'Tehran|Iran|35.6892|51.3890|Asia/Tehran',
  'Kabul|Afghanistan|34.5553|69.2075|Asia/Kabul',
  'Karachi|Pakistan|24.8607|67.0011|Asia/Karachi',
  'Lahore|Pakistan|31.5204|74.3587|Asia/Karachi',
  'Islamabad|Pakistan|33.6844|73.0479|Asia/Karachi',
  'Delhi|India|28.7041|77.1025|Asia/Kolkata',
  'Mumbai|India|19.0760|72.8777|Asia/Kolkata',
  'Bangalore|India|12.9716|77.5946|Asia/Kolkata',
  'Chennai|India|13.0827|80.2707|Asia/Kolkata',
  'Kolkata|India|22.5726|88.3639|Asia/Kolkata',
  'Hyderabad|India|17.3850|78.4867|Asia/Kolkata',
  'Pune|India|18.5204|73.8567|Asia/Kolkata',
  'Ahmedabad|India|23.0225|72.5714|Asia/Kolkata',
  'Jaipur|India|26.9124|75.7873|Asia/Kolkata',
  'Colombo|Sri Lanka|6.9271|79.8612|Asia/Colombo',
  'Kathmandu|Nepal|27.7172|85.3240|Asia/Kathmandu',
  'Dhaka|Bangladesh|23.8103|90.4125|Asia/Dhaka',
  'Yangon|Myanmar|16.8409|96.1735|Asia/Yangon',
  'Bangkok|Thailand|13.7563|100.5018|Asia/Bangkok',
  'Hanoi|Vietnam|21.0278|105.8342|Asia/Ho_Chi_Minh',
  'Ho Chi Minh City|Vietnam|10.8231|106.6297|Asia/Ho_Chi_Minh',
  'Phnom Penh|Cambodia|11.5564|104.9282|Asia/Phnom_Penh',
  'Kuala Lumpur|Malaysia|3.1390|101.6869|Asia/Kuala_Lumpur',
  'Singapore|Singapore|1.3521|103.8198|Asia/Singapore',
  'Jakarta|Indonesia|-6.2088|106.8456|Asia/Jakarta',
  'Surabaya|Indonesia|-7.2575|112.7521|Asia/Jakarta',
  'Denpasar|Indonesia|-8.6500|115.2167|Asia/Makassar',
  'Manila|Philippines|14.5995|120.9842|Asia/Manila',
  'Cebu City|Philippines|10.3157|123.8854|Asia/Manila',
  'Hong Kong|Hong Kong|22.3193|114.1694|Asia/Hong_Kong',
  'Taipei|Taiwan|25.0330|121.5654|Asia/Taipei',
  'Beijing|China|39.9042|116.4074|Asia/Shanghai',
  'Shanghai|China|31.2304|121.4737|Asia/Shanghai',
  'Guangzhou|China|23.1291|113.2644|Asia/Shanghai',
  'Shenzhen|China|22.5431|114.0579|Asia/Shanghai',
  'Chengdu|China|30.5728|104.0668|Asia/Shanghai',
  'Seoul|South Korea|37.5665|126.9780|Asia/Seoul',
  'Busan|South Korea|35.1796|129.0756|Asia/Seoul',
  'Tokyo|Japan|35.6762|139.6503|Asia/Tokyo',
  'Osaka|Japan|34.6937|135.5023|Asia/Tokyo',
  'Kyoto|Japan|35.0116|135.7681|Asia/Tokyo',
  'Sapporo|Japan|43.0618|141.3545|Asia/Tokyo',
  'Ulaanbaatar|Mongolia|47.8864|106.9057|Asia/Ulaanbaatar',
  'Almaty|Kazakhstan|43.2220|76.8512|Asia/Almaty',
  'Tashkent|Uzbekistan|41.2995|69.2401|Asia/Tashkent',
  'Baku|Azerbaijan|40.4093|49.8671|Asia/Baku',
  'Tbilisi|Georgia|41.7151|44.8271|Asia/Tbilisi',
  'Yerevan|Armenia|40.1792|44.4991|Asia/Yerevan',

  'Sydney|Australia|-33.8688|151.2093|Australia/Sydney',
  'Melbourne|Australia|-37.8136|144.9631|Australia/Melbourne',
  'Brisbane|Australia|-27.4698|153.0251|Australia/Brisbane',
  'Perth|Australia|-31.9505|115.8605|Australia/Perth',
  'Adelaide|Australia|-34.9285|138.6007|Australia/Adelaide',
  'Canberra|Australia|-35.2809|149.1300|Australia/Sydney',
  'Hobart|Australia|-42.8821|147.3272|Australia/Hobart',
  'Darwin|Australia|-12.4634|130.8456|Australia/Darwin',
  'Auckland|New Zealand|-36.8485|174.7633|Pacific/Auckland',
  'Wellington|New Zealand|-41.2866|174.7756|Pacific/Auckland',
  'Christchurch|New Zealand|-43.5321|172.6362|Pacific/Auckland',
  'Suva|Fiji|-18.1416|178.4419|Pacific/Fiji',
  'Port Moresby|Papua New Guinea|-9.4438|147.1803|Pacific/Port_Moresby',
]

export const PLACES: Place[] = PACKED.map((row) => {
  const [name, country, latitude, longitude, timeZone] = row.split('|')
  return {
    name,
    country,
    latitude: Number(latitude),
    longitude: Number(longitude),
    timeZone,
  }
})

/** Fold accents, so "Sao Paulo" finds São Paulo and "Zurich" finds Zürich. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Cities matching what has been typed, best first.
 *
 * A name that *starts* with the query beats one that merely contains it, which
 * is what makes "san" offer San Francisco before Santo Domingo, and it falls
 * back to matching the country so that typing "japan" is a way of browsing.
 */
export function searchPlaces(query: string, limit = 6): Place[] {
  const needle = fold(query)
  if (needle.length < 2) return []

  const scored: { place: Place; score: number }[] = []

  for (const place of PLACES) {
    const name = fold(place.name)
    const country = fold(place.country)

    let score = 0
    if (name === needle) score = 100
    else if (name.startsWith(needle)) score = 80 - name.length / 100
    else if (name.includes(needle)) score = 50 - name.length / 100
    else if (country.startsWith(needle)) score = 30
    else if (country.includes(needle)) score = 20
    else continue

    scored.push({ place, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .slice(0, limit)
    .map((entry) => entry.place)
}

/** The listed city nearest a latitude and longitude, for a device that knows. */
export function nearestPlace(latitude: number, longitude: number): Place {
  let best = PLACES[0]
  let closest = Number.POSITIVE_INFINITY

  for (const place of PLACES) {
    // Equirectangular, which is exact enough to pick a city and costs two
    // multiplications instead of six trigonometric calls.
    const dx = (place.longitude - longitude) * Math.cos((latitude * Math.PI) / 180)
    const dy = place.latitude - latitude
    const distance = dx * dx + dy * dy
    if (distance < closest) {
      closest = distance
      best = place
    }
  }

  return best
}
