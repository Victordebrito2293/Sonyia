import { francAll } from 'franc';

/**
 * Detecção local de idioma a partir do texto já transcrito.
 *
 * `franc` é uma heurística estatística de trigramas (MIT), não uma rede neural;
 * ela não produz uma "precisão" garantida. Usamos apenas para escolher o prompt
 * de idioma do Whisper e para rotular o resultado quando o modelo não expõe o
 * idioma detectado (o Transformers.js 4.3.2 sempre assume inglês se omitido).
 */
const ISO_TO_LANGUAGE: Record<string, string> = {
  eng: 'english',
  por: 'portuguese',
  spa: 'spanish',
  fra: 'french',
  deu: 'german',
  ita: 'italian',
  nld: 'dutch',
  jpn: 'japanese',
  zho: 'chinese',
  kor: 'korean',
  hin: 'hindi',
  ara: 'arabic',
  rus: 'russian',
  pol: 'polish',
  swe: 'swedish',
  dan: 'danish',
  fin: 'finnish',
  nor: 'norwegian',
  tur: 'turkish',
  ukr: 'ukrainian',
  ces: 'czech',
  hun: 'hungarian',
  ron: 'romanian',
  ell: 'greek',
  heb: 'hebrew',
  tha: 'thai',
  vie: 'vietnamese',
  ind: 'indonesian',
};

const LANGUAGE_TO_WHISPER_CODE: Record<string, string> = {
  english: 'en',
  portuguese: 'pt',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  dutch: 'nl',
  japanese: 'ja',
  chinese: 'zh',
  korean: 'ko',
  hindi: 'hi',
  arabic: 'ar',
  russian: 'ru',
  polish: 'pl',
  swedish: 'sv',
  danish: 'da',
  finnish: 'fi',
  norwegian: 'no',
  turkish: 'tr',
  ukrainian: 'uk',
  czech: 'cs',
  hungarian: 'hu',
  romanian: 'ro',
  greek: 'el',
  hebrew: 'he',
  thai: 'th',
  vietnamese: 'vi',
  indonesian: 'id',
};

const ALLOWED = Object.keys(ISO_TO_LANGUAGE);

/** Whisper aceita códigos ISO 639-1 no prompt de idioma. */
export function whisperLanguageCode(language: string | null): string | null {
  return language ? LANGUAGE_TO_WHISPER_CODE[language.toLowerCase()] ?? null : null;
}

/** Remove marcas de tempo para que não influenciem a contagem de trigramas. */
function cleanForDetection(text: string): string {
  return text
    .replace(/\[\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?\]/g, ' ')
    .replace(/[0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Retorna o nome canônico do idioma ou null quando a amostra é inconclusiva. */
export function detectLanguage(text: string): string | null {
  const sample = cleanForDetection(text);
  if (sample.length < 16) return null;

  const ranked = francAll(sample, { only: ALLOWED, minLength: 8 });
  const [best, second] = ranked;
  if (!best) return null;

  // A pontuação de franc é uma distância normalizada: 1 é coincidência exata.
  // Exigimos uma vantagem mínima sobre o segundo colocado para evitar chutes.
  if (second && best[1] - second[1] < 0.03) return null;
  return ISO_TO_LANGUAGE[best[0]] ?? null;
}
