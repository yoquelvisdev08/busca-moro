export interface DiscoverOption {
  value: string;
  label: string;
  /** Texto extra para el filtro del buscador (sin acentos opcional). */
  keywords?: string;
}

export const DISCOVER_COUNTRIES: DiscoverOption[] = [
  { value: "", label: "Todos los países", keywords: "global mundo all" },
  { value: "España", label: "España", keywords: "spain es madrid barcelona" },
  { value: "México", label: "México", keywords: "mexico mx cdmx guadalajara" },
  { value: "Argentina", label: "Argentina", keywords: "ar buenos aires" },
  { value: "Colombia", label: "Colombia", keywords: "co bogota medellin" },
  { value: "Chile", label: "Chile", keywords: "cl santiago" },
  { value: "Perú", label: "Perú", keywords: "peru pe lima" },
  { value: "Ecuador", label: "Ecuador", keywords: "ec quito guayaquil" },
  { value: "Venezuela", label: "Venezuela", keywords: "ve caracas" },
  { value: "Uruguay", label: "Uruguay", keywords: "uy montevideo" },
  { value: "Paraguay", label: "Paraguay", keywords: "py asuncion" },
  { value: "Bolivia", label: "Bolivia", keywords: "bo la paz" },
  { value: "Costa Rica", label: "Costa Rica", keywords: "cr san jose" },
  { value: "Panamá", label: "Panamá", keywords: "panama pa" },
  { value: "República Dominicana", label: "República Dominicana", keywords: "rd dominicana santo domingo" },
  { value: "Guatemala", label: "Guatemala", keywords: "gt" },
  { value: "Honduras", label: "Honduras", keywords: "hn" },
  { value: "El Salvador", label: "El Salvador", keywords: "sv" },
  { value: "Nicaragua", label: "Nicaragua", keywords: "ni" },
  { value: "Puerto Rico", label: "Puerto Rico", keywords: "pr" },
  { value: "Cuba", label: "Cuba", keywords: "cu habana" },
  { value: "Brasil", label: "Brasil", keywords: "brasil brazil sao paulo rio" },
  { value: "Portugal", label: "Portugal", keywords: "pt lisboa porto" },
  { value: "Estados Unidos", label: "Estados Unidos", keywords: "usa us united states miami texas california" },
  { value: "Canadá", label: "Canadá", keywords: "canada ca toronto vancouver" },
  { value: "Reino Unido", label: "Reino Unido", keywords: "uk britain london" },
  { value: "Alemania", label: "Alemania", keywords: "germany de berlin" },
  { value: "Francia", label: "Francia", keywords: "france paris" },
  { value: "Italia", label: "Italia", keywords: "italy rome milan" },
  { value: "Países Bajos", label: "Países Bajos", keywords: "netherlands holanda amsterdam" },
  { value: "Suiza", label: "Suiza", keywords: "switzerland zurich" },
  { value: "Australia", label: "Australia", keywords: "au sydney melbourne" },
];

export const DISCOVER_INDUSTRIES: DiscoverOption[] = [
  { value: "Clínicas dentales", label: "Clínicas dentales", keywords: "dental dentist odontologia" },
  { value: "Clínicas médicas y salud", label: "Clínicas médicas y salud", keywords: "medico hospital salud" },
  { value: "Abogados y bufetes", label: "Abogados y bufetes", keywords: "legal lawyer juridico" },
  { value: "Inmobiliarias", label: "Inmobiliarias", keywords: "real estate propiedades" },
  { value: "Hoteles y turismo", label: "Hoteles y turismo", keywords: "hotel travel hospedaje" },
  { value: "Restaurantes y catering", label: "Restaurantes y catering", keywords: "restaurant food comida" },
  { value: "Gimnasios y wellness", label: "Gimnasios y wellness", keywords: "gym fitness yoga" },
  { value: "Belleza y estética", label: "Belleza y estética", keywords: "spa estetica peluqueria" },
  { value: "Veterinarias", label: "Veterinarias", keywords: "vet mascotas" },
  { value: "Automoción y talleres", label: "Automoción y talleres", keywords: "taller coches autos" },
  { value: "Construcción y reformas", label: "Construcción y reformas", keywords: "obra reformas arquitectura" },
  { value: "Academias y formación", label: "Academias y formación", keywords: "cursos escuela educacion" },
  { value: "Seguros y asesorías financieras", label: "Seguros y asesorías financieras", keywords: "finanzas seguros contabilidad" },
  { value: "Eventos y bodas", label: "Eventos y bodas", keywords: "wedding eventos" },
  { value: "E-commerce y retail", label: "E-commerce y retail", keywords: "tienda online shopify woocommerce" },
  { value: "Logística y transporte", label: "Logística y transporte", keywords: "envios transporte" },
  { value: "Manufactura industrial", label: "Manufactura industrial", keywords: "fabrica industrial b2b" },
  { value: "Software y SaaS B2B", label: "Software y SaaS B2B", keywords: "saas software startup tech" },
  { value: "Agencias de marketing", label: "Agencias de marketing", keywords: "marketing publicidad seo" },
  { value: "Consultoría de negocios", label: "Consultoría de negocios", keywords: "consultoria coaching" },
  { value: "Servicios profesionales (general)", label: "Servicios profesionales (general)", keywords: "servicios empresa pyme" },
  { value: "ONG y fundaciones", label: "ONG y fundaciones", keywords: "ong nonprofit" },
  { value: "Desarrollo inmobiliario", label: "Desarrollo inmobiliario", keywords: "promotora vivienda" },
  { value: "Clínicas veterinarias premium", label: "Clínicas veterinarias premium", keywords: "vet premium" },
  { value: "Centros de fisioterapia", label: "Centros de fisioterapia", keywords: "fisio rehabilitacion" },
  { value: "Ópticas y audiología", label: "Ópticas y audiología", keywords: "optica gafas" },
  { value: "Funerarias y servicios locales", label: "Funerarias y servicios locales", keywords: "funeraria local" },
  { value: "Franquicias locales", label: "Franquicias locales", keywords: "franquicia sucursal" },
];

export function filterDiscoverOptions(
  options: DiscoverOption[],
  query: string,
): DiscoverOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((opt) => {
    const haystack = `${opt.label} ${opt.value} ${opt.keywords ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}
