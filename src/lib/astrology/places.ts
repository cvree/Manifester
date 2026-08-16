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

  'Oxnard|United States|34.1975|-119.1771|America/Los_Angeles',
  'Bakersfield|United States|35.3733|-119.0187|America/Los_Angeles',
  'Fresno|United States|36.7378|-119.7871|America/Los_Angeles',
  'Long Beach|United States|33.7701|-118.1937|America/Los_Angeles',
  'Anaheim|United States|33.8366|-117.9143|America/Los_Angeles',
  'Riverside|United States|33.9806|-117.3755|America/Los_Angeles',
  'Santa Ana|United States|33.7455|-117.8677|America/Los_Angeles',
  'Irvine|United States|33.6846|-117.8265|America/Los_Angeles',
  'Stockton|United States|37.9577|-121.2908|America/Los_Angeles',
  'Oakland|United States|37.8044|-122.2712|America/Los_Angeles',
  'Santa Barbara|United States|34.4208|-119.6982|America/Los_Angeles',
  'Spokane|United States|47.6588|-117.4260|America/Los_Angeles',
  'Tacoma|United States|47.2529|-122.4443|America/Los_Angeles',
  'Boise|United States|43.6150|-116.2023|America/Boise',
  'Reno|United States|39.5296|-119.8138|America/Los_Angeles',
  'Tucson|United States|32.2226|-110.9747|America/Phoenix',
  'Mesa|United States|33.4152|-111.8315|America/Phoenix',
  'El Paso|United States|31.7619|-106.4850|America/Denver',
  'Colorado Springs|United States|38.8339|-104.8214|America/Denver',
  'Fort Worth|United States|32.7555|-97.3308|America/Chicago',
  'El Segundo|United States|33.9192|-118.4165|America/Los_Angeles',
  'Arlington|United States|32.7357|-97.1081|America/Chicago',
  'Omaha|United States|41.2565|-95.9345|America/Chicago',
  'Des Moines|United States|41.5868|-93.6250|America/Chicago',
  'Wichita|United States|37.6872|-97.3301|America/Chicago',
  'Tulsa|United States|36.1540|-95.9928|America/Chicago',
  'Little Rock|United States|34.7465|-92.2896|America/Chicago',
  'Baton Rouge|United States|30.4515|-91.1871|America/Chicago',
  'Birmingham|United States|33.5186|-86.8104|America/Chicago',
  'Madison|United States|43.0731|-89.4012|America/Chicago',
  'Louisville|United States|38.2527|-85.7585|America/New_York',
  'Cincinnati|United States|39.1031|-84.5120|America/New_York',
  'Buffalo|United States|42.8864|-78.8784|America/New_York',
  'Rochester|United States|43.1566|-77.6088|America/New_York',
  'Albany|United States|42.6526|-73.7562|America/New_York',
  'Hartford|United States|41.7658|-72.6734|America/New_York',
  'Providence|United States|41.8240|-71.4128|America/New_York',
  'Newark|United States|40.7357|-74.1724|America/New_York',
  'Jersey City|United States|40.7178|-74.0431|America/New_York',
  'Virginia Beach|United States|36.8529|-75.9780|America/New_York',
  'Richmond|United States|37.5407|-77.4360|America/New_York',
  'Raleigh|United States|35.7796|-78.6382|America/New_York',
  'Jacksonville|United States|30.3322|-81.6557|America/New_York',
  'Fort Lauderdale|United States|26.1224|-80.1373|America/New_York',
  'St. Petersburg|United States|27.7676|-82.6403|America/New_York',
  'Greensboro|United States|36.0726|-79.7920|America/New_York',
  'Knoxville|United States|35.9606|-83.9207|America/New_York',
  'Syracuse|United States|43.0481|-76.1474|America/New_York',
  'Leeds|United Kingdom|53.8008|-1.5491|Europe/London',
  'Liverpool|United Kingdom|53.4084|-2.9916|Europe/London',
  'Sheffield|United Kingdom|53.3811|-1.4701|Europe/London',
  'Bristol|United Kingdom|51.4545|-2.5879|Europe/London',
  'Nottingham|United Kingdom|52.9548|-1.1581|Europe/London',
  'Leicester|United Kingdom|52.6369|-1.1398|Europe/London',
  'Newcastle|United Kingdom|54.9783|-1.6178|Europe/London',
  'Cardiff|United Kingdom|51.4816|-3.1791|Europe/London',
  'Belfast|United Kingdom|54.5973|-5.9301|Europe/London',
  'Southampton|United Kingdom|50.9097|-1.4044|Europe/London',
  'Brighton|United Kingdom|50.8225|-0.1372|Europe/London',
  'Cork|Ireland|51.8985|-8.4756|Europe/Dublin',
  'Galway|Ireland|53.2707|-9.0568|Europe/Dublin',
  'Hamilton|Canada|43.2557|-79.8711|America/Toronto',
  'London|Canada|42.9849|-81.2453|America/Toronto',
  'Kitchener|Canada|43.4516|-80.4925|America/Toronto',
  'Victoria|Canada|48.4284|-123.3656|America/Vancouver',
  'Saskatoon|Canada|52.1332|-106.6700|America/Regina',
  'Regina|Canada|50.4452|-104.6189|America/Regina',
  'St. John\u2019s|Canada|47.5615|-52.7126|America/St_Johns',
  'Gold Coast|Australia|-28.0167|153.4000|Australia/Brisbane',
  'Newcastle|Australia|-32.9283|151.7817|Australia/Sydney',
  'Wollongong|Australia|-34.4278|150.8931|Australia/Sydney',
  'Geelong|Australia|-38.1499|144.3617|Australia/Melbourne',
  'Cairns|Australia|-16.9186|145.7781|Australia/Brisbane',
  'Hamilton|New Zealand|-37.7870|175.2793|Pacific/Auckland',
  'Dunedin|New Zealand|-45.8788|170.5028|Pacific/Auckland',
  'Seville|Spain|37.3891|-5.9845|Europe/Madrid',
  'Bilbao|Spain|43.2630|-2.9350|Europe/Madrid',
  'Malaga|Spain|36.7213|-4.4214|Europe/Madrid',
  'Palma|Spain|39.5696|2.6502|Europe/Madrid',
  'Las Palmas|Spain|28.1235|-15.4363|Atlantic/Canary',
  'Turin|Italy|45.0703|7.6869|Europe/Rome',
  'Florence|Italy|43.7696|11.2558|Europe/Rome',
  'Bologna|Italy|44.4949|11.3426|Europe/Rome',
  'Venice|Italy|45.4408|12.3155|Europe/Rome',
  'Palermo|Italy|38.1157|13.3615|Europe/Rome',
  'Catania|Italy|37.5079|15.0830|Europe/Rome',
  'Nice|France|43.7102|7.2620|Europe/Paris',
  'Toulouse|France|43.6047|1.4442|Europe/Paris',
  'Bordeaux|France|44.8378|-0.5792|Europe/Paris',
  'Nantes|France|47.2184|-1.5536|Europe/Paris',
  'Lille|France|50.6292|3.0573|Europe/Paris',
  'Strasbourg|France|48.5734|7.7521|Europe/Paris',
  'Stuttgart|Germany|48.7758|9.1829|Europe/Berlin',
  'Dusseldorf|Germany|51.2277|6.7735|Europe/Berlin',
  'Leipzig|Germany|51.3397|12.3731|Europe/Berlin',
  'Dresden|Germany|51.0504|13.7373|Europe/Berlin',
  'Bremen|Germany|53.0793|8.8017|Europe/Berlin',
  'Nuremberg|Germany|49.4521|11.0767|Europe/Berlin',
  'Hanover|Germany|52.3759|9.7320|Europe/Berlin',
  'Antwerp|Belgium|51.2194|4.4025|Europe/Brussels',
  'Ghent|Belgium|51.0543|3.7174|Europe/Brussels',
  'The Hague|Netherlands|52.0705|4.3007|Europe/Amsterdam',
  'Utrecht|Netherlands|52.0907|5.1214|Europe/Amsterdam',
  'Eindhoven|Netherlands|51.4416|5.4697|Europe/Amsterdam',
  'Salzburg|Austria|47.8095|13.0550|Europe/Vienna',
  'Graz|Austria|47.0707|15.4395|Europe/Vienna',
  'Basel|Switzerland|47.5596|7.5886|Europe/Zurich',
  'Bern|Switzerland|46.9480|7.4474|Europe/Zurich',
  'Bergen|Norway|60.3913|5.3221|Europe/Oslo',
  'Malmo|Sweden|55.6050|13.0038|Europe/Stockholm',
  'Aarhus|Denmark|56.1629|10.2039|Europe/Copenhagen',
  'Tampere|Finland|61.4978|23.7610|Europe/Helsinki',
  'Wroclaw|Poland|51.1079|17.0385|Europe/Warsaw',
  'Gdansk|Poland|54.3520|18.6466|Europe/Warsaw',
  'Poznan|Poland|52.4064|16.9252|Europe/Warsaw',
  'Brno|Czechia|49.1951|16.6068|Europe/Prague',
  'Bratislava|Slovakia|48.1486|17.1077|Europe/Bratislava',
  'Ljubljana|Slovenia|46.0569|14.5058|Europe/Ljubljana',
  'Sarajevo|Bosnia and Herzegovina|43.8563|18.4131|Europe/Sarajevo',
  'Skopje|North Macedonia|41.9981|21.4254|Europe/Skopje',
  'Tirana|Albania|41.3275|19.8187|Europe/Tirane',
  'Thessaloniki|Greece|40.6401|22.9444|Europe/Athens',
  'Nicosia|Cyprus|35.1856|33.3823|Asia/Nicosia',
  'Valletta|Malta|35.8989|14.5146|Europe/Malta',
  'Luxembourg|Luxembourg|49.6116|6.1319|Europe/Luxembourg',
  'Izmir|Turkey|38.4237|27.1428|Europe/Istanbul',
  'Antalya|Turkey|36.8969|30.7133|Europe/Istanbul',
  'Haifa|Israel|32.7940|34.9896|Asia/Jerusalem',
  'Sharjah|United Arab Emirates|25.3463|55.4209|Asia/Dubai',
  'Mecca|Saudi Arabia|21.3891|39.8579|Asia/Riyadh',
  'Isfahan|Iran|32.6546|51.6680|Asia/Tehran',
  'Mashhad|Iran|36.2605|59.6168|Asia/Tehran',
  'Rawalpindi|Pakistan|33.5651|73.0169|Asia/Karachi',
  'Faisalabad|Pakistan|31.4187|73.0791|Asia/Karachi',
  'Lucknow|India|26.8467|80.9462|Asia/Kolkata',
  'Kanpur|India|26.4499|80.3319|Asia/Kolkata',
  'Nagpur|India|21.1458|79.0882|Asia/Kolkata',
  'Indore|India|22.7196|75.8577|Asia/Kolkata',
  'Bhopal|India|23.2599|77.4126|Asia/Kolkata',
  'Patna|India|25.5941|85.1376|Asia/Kolkata',
  'Surat|India|21.1702|72.8311|Asia/Kolkata',
  'Kochi|India|9.9312|76.2673|Asia/Kolkata',
  'Chittagong|Bangladesh|22.3569|91.7832|Asia/Dhaka',
  'Chiang Mai|Thailand|18.7883|98.9853|Asia/Bangkok',
  'Da Nang|Vietnam|16.0544|108.2022|Asia/Ho_Chi_Minh',
  'Penang|Malaysia|5.4141|100.3288|Asia/Kuala_Lumpur',
  'Bandung|Indonesia|-6.9175|107.6191|Asia/Jakarta',
  'Medan|Indonesia|3.5952|98.6722|Asia/Jakarta',
  'Davao|Philippines|7.1907|125.4553|Asia/Manila',
  'Quezon City|Philippines|14.6760|121.0437|Asia/Manila',
  'Macau|Macau|22.1987|113.5439|Asia/Macau',
  'Kaohsiung|Taiwan|22.6273|120.3014|Asia/Taipei',
  'Tianjin|China|39.3434|117.3616|Asia/Shanghai',
  'Wuhan|China|30.5928|114.3055|Asia/Shanghai',
  'Xi\u2019an|China|34.3416|108.9398|Asia/Shanghai',
  'Hangzhou|China|30.2741|120.1551|Asia/Shanghai',
  'Nanjing|China|32.0603|118.7969|Asia/Shanghai',
  'Qingdao|China|36.0671|120.3826|Asia/Shanghai',
  'Harbin|China|45.8038|126.5349|Asia/Shanghai',
  'Incheon|South Korea|37.4563|126.7052|Asia/Seoul',
  'Daegu|South Korea|35.8714|128.6014|Asia/Seoul',
  'Nagoya|Japan|35.1815|136.9066|Asia/Tokyo',
  'Fukuoka|Japan|33.5904|130.4017|Asia/Tokyo',
  'Yokohama|Japan|35.4437|139.6380|Asia/Tokyo',
  'Kobe|Japan|34.6901|135.1955|Asia/Tokyo',
  'Hiroshima|Japan|34.3853|132.4553|Asia/Tokyo',
  'Okinawa|Japan|26.2124|127.6809|Asia/Tokyo',
  'Vladivostok|Russia|43.1332|131.9113|Asia/Vladivostok',
  'Novosibirsk|Russia|55.0084|82.9357|Asia/Novosibirsk',
  'Yekaterinburg|Russia|56.8389|60.6057|Asia/Yekaterinburg',
  'Minsk|Belarus|53.9006|27.5590|Europe/Minsk',
  'Chisinau|Moldova|47.0105|28.8638|Europe/Chisinau',
  'Tehran|Iran|35.6892|51.3890|Asia/Tehran',
  'Port Louis|Mauritius|-20.1609|57.5012|Indian/Mauritius',
  'Antananarivo|Madagascar|-18.8792|47.5079|Indian/Antananarivo',
  'Maputo|Mozambique|-25.9692|32.5732|Africa/Maputo',
  'Gaborone|Botswana|-24.6282|25.9231|Africa/Gaborone',
  'Windhoek|Namibia|-22.5609|17.0658|Africa/Windhoek',
  'Port Elizabeth|South Africa|-33.9608|25.6022|Africa/Johannesburg',
  'Bloemfontein|South Africa|-29.0852|26.1596|Africa/Johannesburg',
  'Marrakesh|Morocco|31.6295|-7.9811|Africa/Casablanca',
  'Tangier|Morocco|35.7595|-5.8340|Africa/Casablanca',
  'Douala|Cameroon|4.0511|9.7679|Africa/Douala',
  'Bamako|Mali|12.6392|-8.0029|Africa/Bamako',
  'Conakry|Guinea|9.6412|-13.5784|Africa/Conakry',
  'Freetown|Sierra Leone|8.4657|-13.2317|Africa/Freetown',
  'Monrovia|Liberia|6.2907|-10.7605|Africa/Monrovia',
  'Cotonou|Benin|6.3703|2.3912|Africa/Porto-Novo',
  'Lome|Togo|6.1319|1.2228|Africa/Lome',
  'Puebla|Mexico|19.0414|-98.2063|America/Mexico_City',
  'Cancun|Mexico|21.1619|-86.8515|America/Cancun',
  'Merida|Mexico|20.9674|-89.5926|America/Merida',
  'Chihuahua|Mexico|28.6330|-106.0691|America/Chihuahua',
  'Rosario|Argentina|-32.9442|-60.6505|America/Argentina/Buenos_Aires',
  'Mendoza|Argentina|-32.8895|-68.8458|America/Argentina/Mendoza',
  'Valparaiso|Chile|-33.0472|-71.6127|America/Santiago',
  'Cali|Colombia|3.4516|-76.5320|America/Bogota',
  'Barranquilla|Colombia|10.9685|-74.7813|America/Bogota',
  'Guayaquil|Ecuador|-2.1894|-79.8891|America/Guayaquil',
  'Cusco|Peru|-13.5320|-71.9675|America/Lima',
  'Santa Cruz|Bolivia|-17.7833|-63.1821|America/La_Paz',
  'Curitiba|Brazil|-25.4284|-49.2733|America/Sao_Paulo',
  'Belem|Brazil|-1.4558|-48.4902|America/Belem',
  'Goiania|Brazil|-16.6869|-49.2648|America/Sao_Paulo',
  'Campinas|Brazil|-22.9099|-47.0626|America/Sao_Paulo',
  'Belo Horizonte|Brazil|-19.9167|-43.9345|America/Sao_Paulo',
  'Natal|Brazil|-5.7945|-35.2110|America/Fortaleza',
  'Nassau|Bahamas|25.0443|-77.3504|America/Nassau',
  'Bridgetown|Barbados|13.1132|-59.5988|America/Barbados',
  'Port of Spain|Trinidad and Tobago|10.6596|-61.5019|America/Port_of_Spain',
  'Tegucigalpa|Honduras|14.0723|-87.1921|America/Tegucigalpa',
  'Managua|Nicaragua|12.1149|-86.2362|America/Managua',
  'San Salvador|El Salvador|13.6929|-89.2182|America/El_Salvador',
  'Port-au-Prince|Haiti|18.5944|-72.3074|America/Port-au-Prince',
  'Honolulu|United States|21.3069|-157.8583|Pacific/Honolulu',
  'Papeete|French Polynesia|-17.5516|-149.5585|Pacific/Tahiti',
  'Noumea|New Caledonia|-22.2758|166.4580|Pacific/Noumea',
  'Apia|Samoa|-13.8507|-171.7514|Pacific/Apia',
  'Guam|Guam|13.4443|144.7937|Pacific/Guam',
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

/* ── Anywhere that is not on the list ────────────────────────── */

/**
 * Every time zone the browser knows, which is all of them.
 *
 * This is the escape hatch that makes the city list a convenience rather than
 * a gate. No list of a few hundred cities will ever contain everybody's
 * birthplace — Oxnard is a city of two hundred thousand people and it is not
 * here — and a form that refuses to continue because it has never heard of
 * where somebody was born is the app calling them wrong.
 *
 * So the list stops being the authority. What the chart actually needs from a
 * birthplace is the **time zone**, and the browser ships the entire IANA
 * database. `Intl.supportedValuesOf` hands the whole thing over for nothing,
 * and the coordinates are taken from the nearest listed city that shares the
 * zone — which is at worst a few hundred kilometres, and a few hundred
 * kilometres is a fraction of a degree of Ascendant.
 */
export function allZones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('timeZone')
    if (supported && supported.length > 0) return supported
  } catch {
    /* An older engine. The bundled zones are still a real answer. */
  }
  return [...new Set(PLACES.map((place) => place.timeZone))].sort()
}

/** The city part of `America/Los_Angeles`, as somebody would read it. */
export function zoneLabel(zone: string): string {
  const parts = zone.split('/')
  return parts[parts.length - 1].replace(/_/g, ' ')
}

/** The region part, for the line underneath. */
export function zoneRegion(zone: string): string {
  return zone.split('/')[0].replace(/_/g, ' ')
}

/** Zones matching what has been typed, city part first. */
export function searchZones(query: string, limit = 8): string[] {
  const needle = fold(query)
  if (needle.length < 2) return []

  const scored: { zone: string; score: number }[] = []
  for (const zone of allZones()) {
    const city = fold(zoneLabel(zone))
    const whole = fold(zone.replace(/[_/]/g, ' '))
    let score = 0
    if (city === needle) score = 100
    else if (city.startsWith(needle)) score = 80
    else if (city.includes(needle)) score = 55
    else if (whole.includes(needle)) score = 30
    else continue
    scored.push({ zone, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.zone.localeCompare(b.zone))
    .slice(0, limit)
    .map((entry) => entry.zone)
}

/**
 * A usable place from a zone and whatever the person called it.
 *
 * The name is *theirs*. Somebody who typed "Oxnard" should be shown Oxnard
 * back, not "Los Angeles" — the app borrowed a nearby city's coordinates and
 * that is an implementation detail, not a correction of where they were born.
 */
export function placeFromZone(name: string, zone: string): Place {
  const region = zone.includes('/') ? zoneRegion(zone) : ''

  const sharing = PLACES.filter((place) => place.timeZone === zone)
  if (sharing.length > 0) {
    return { ...sharing[0], name: name.trim() || zoneLabel(zone) }
  }

  /*
   * A zone with no listed city in it — around half of the four hundred the
   * browser knows.
   *
   * Longitude follows from the offset, because fifteen degrees an hour is what
   * a time zone *is*, and that is the coordinate the Ascendant is most
   * sensitive to. Latitude is taken from the listed city on the nearest offset
   * rather than left at zero: the equator is a specific and usually wrong
   * place, and "somewhere on this meridian at a plausible latitude" is a far
   * better guess than "the Gulf of Guinea".
   */
  const hours = zoneOffsetHours(zone)

  let latitude = 0
  let closest = Number.POSITIVE_INFINITY
  for (const place of PLACES) {
    const gap = Math.abs(zoneOffsetHours(place.timeZone) - hours)
    if (gap < closest) {
      closest = gap
      latitude = place.latitude
    }
  }

  return {
    name: name.trim() || zoneLabel(zone),
    country: region,
    latitude,
    longitude: hours * 15,
    timeZone: zone,
  }
}

/** How far ahead of UTC a zone is right now, in hours. Cached: it is asked in a loop. */
const offsetCache = new Map<string, number>()

function zoneOffsetHours(zone: string): number {
  const known = offsetCache.get(zone)
  if (known != null) return known

  let hours = 0
  try {
    const shown = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value
    const match = shown?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (match) {
      hours =
        (match[1] === '-' ? -1 : 1) *
        (Number(match[2]) + Number(match[3] ?? 0) / 60)
    }
  } catch {
    /* Greenwich, rather than refusing somebody's birthplace. */
  }

  offsetCache.set(zone, hours)
  return hours
}

/**
 * A short list of zones to offer when there is nothing to go on.
 *
 * The fallback needs a floor. Searching by name works when somebody's
 * birthplace shares a name with a zone — plenty do — and does nothing at all
 * for the far greater number that do not: there is no `Australia/Wagga_Wagga`,
 * and a "pick a time zone" step that returns no results is the same dead end
 * with an extra step in front of it.
 *
 * So these are always on offer. Chosen to cover the largest populations and to
 * span the clock, so that scrolling to a neighbouring offset is never far.
 */
export const COMMON_ZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Athens',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
]
