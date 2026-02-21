/**
 * Abstraktion over ekstern datahentning (DAWA + BBR).
 * Nemt at udskifte kilder senere.
 */

const DAWA_AUTOCOMPLETE = 'https://api.dataforsyningen.dk/autocomplete';
const DAWA_ADRESSER = 'https://api.dataforsyningen.dk/adresser';
const DAWA_ADGANG = 'https://api.dataforsyningen.dk/adgangsadresser';

/**
 * Hent adgangsadresse.id fra adressesøgning via /adresser.
 * @param {string} address - Adressesøgning
 * @returns {Promise<string|null>} Adgangsadresse UUID eller null
 */
async function getAdgangsadresseIdFromAddress(address) {
  if (!address?.trim()) return null;
  try {
    const qs = new URLSearchParams({
      q: address.trim(),
      format: 'json',
      per_side: 1,
    });
    const res = await fetch(`${DAWA_ADRESSER}?${qs}`);
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : data;
    return first?.adgangsadresse?.id || null;
  } catch (err) {
    console.error('DAWA adresser fejl:', err.message);
    return null;
  }
}

/**
 * Hent adresseforslag fra DAWA autocomplete.
 * Bruges typisk client-side; serveren kan også kalde denne.
 * @param {string} query - Søgetekst
 * @returns {Promise<Array<{tekst: string, id: string}>>}
 */
async function getAddressSuggestions(query) {
  if (!query || query.trim().length < 3) return [];
  try {
    const qs = new URLSearchParams({
      q: query.trim(),
      type: 'adresse',
      caretpos: 0,
      forskellige: 1,
    });
    const res = await fetch(`${DAWA_AUTOCOMPLETE}?${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : [])
      .filter((item) => item.type === 'adgangsadresse' && item.data?.id)
      .map((item) => ({
        tekst: item.tekst || item.forslagstekst || '',
        id: item.data.id,
      }));
  } catch (err) {
    console.error('DAWA autocomplete fejl:', err.message);
    return [];
  }
}

/**
 * Hent adgangsadresse-detaljer fra DAWA (inkl. koordinater).
 * @param {string} dawaAddressId - Adgangsadresse UUID
 * @returns {Promise<Object|null>}
 */
async function getAdgangsadresse(dawaAddressId) {
  try {
    const res = await fetch(`${DAWA_ADGANG}/${encodeURIComponent(dawaAddressId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('DAWA adgangsadresse fejl:', err.message);
    return null;
  }
}

/**
 * Hent rå BBR-ejendomsdata fra Datafordeler (bygning-endpoint).
 * @param {string} adgangsadresseId - DAWA adgangsadresse ID (husnummer-id)
 * @returns {Promise<{normalized: Object, raw: Object}|null>}
 */
async function getBBRPropertyData(adgangsadresseId) {
  const username = process.env.BBR_USERNAME;
  const password = process.env.BBR_PASSWORD;
  if (!username || !password) {
    console.warn('BBR_USERNAME/BBR_PASSWORD ikke sat – springer BBR over');
    return null;
  }
  try {
    const qs = new URLSearchParams({
      husnummer: adgangsadresseId,
      status: 6,
      username,
      password,
    });
    const url = `https://services.datafordeler.dk/BBR/BBRPublic/1/rest/bygning?${qs}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('BBR API fejl:', res.status, res.statusText);
      return null;
    }
    const raw = await res.json();
    return { normalized: normalizeBBRResponse(raw), raw };
  } catch (err) {
    console.error('BBR hent fejl:', err.message);
    return null;
  }
}

function normalizeBBRResponse(data) {
  const items = Array.isArray(data) ? data : data?.features ?? [];
  const bygning = items.find((b) => b?.byg007Bygningsnummer === 1 || b?.byg007Bygningsnummer === '1') ?? items[0];
  if (!bygning) {
    return { buildingType: 'villa', areaM2: 80, floors: 1, builtYear: null };
  }
  const area = bygning.byg038SamletBygningsareal ?? 80;
  const floors = bygning.byg054AntalEtager ?? 1;
  const builtYear = bygning.byg026Opførelsesår ?? bygning.byg026Opfoerelsesaar ?? null;
  const typeCode = String(bygning.byg021BygningensAnvendelse || '');
  const buildingType = mapBBRTypeToSimple(typeCode);
  return {
    buildingType,
    areaM2: Number(area) || 80,
    floors: Math.max(1, Math.round(Number(floors)) || 1),
    builtYear: builtYear != null ? Number(builtYear) : null,
  };
}

function mapBBRTypeToSimple(code) {
  const m = {
    '110': 'stuehus',
    '120': 'parcelhus',
    '130': 'rækkehus',
    '140': 'etagebolig',
  };
  return m[String(code)] || 'parcelhus';
}

/**
 * Hent fuld ejendomsdata. Kan modtage enten adgangsadresse.id eller adressetekst.
 * Ved adressetekst kaldes /adresser først for at hente adgangsadresse.id.
 * @param {string} addressOrId - Adgangsadresse UUID eller adressesøgning
 * @returns {Promise<{normalized: Object, rawBBR: Object|null}|null>}
 */
async function getPropertyData(addressOrId) {
  let adgangsadresseId = addressOrId?.trim();
  if (!adgangsadresseId) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adgangsadresseId);
  if (!isUuid) {
    adgangsadresseId = await getAdgangsadresseIdFromAddress(adgangsadresseId);
    if (!adgangsadresseId) return null;
  }
  try {
    const adgang = await getAdgangsadresse(adgangsadresseId);
    const coords = adgang?.adgangspunkt?.koordinater;
    const coordinates =
      Array.isArray(coords) && coords.length >= 2
        ? { lat: coords[1], lng: coords[0] }
        : null;

    const bbr = await getBBRPropertyData(adgangsadresseId);
    if (bbr) {
      return {
        normalized: { ...bbr.normalized, coordinates },
        rawBBR: bbr.raw,
      };
    }
    const area = adgang?.etageareal ?? 80;
    return {
      normalized: {
        buildingType: 'parcelhus',
        areaM2: Number(area) || 80,
        floors: 1,
        builtYear: null,
        coordinates,
      },
      rawBBR: null,
    };
  } catch (err) {
    console.error('getPropertyData fejl:', err.message);
    return null;
  }
}

module.exports = {
  getAddressSuggestions,
  getAdgangsadresseIdFromAddress,
  getPropertyData,
  getAdgangsadresse,
  getBBRPropertyData,
};
