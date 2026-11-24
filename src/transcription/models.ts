import type { ModelId } from '../core/types';
import type { TranslationKey } from '../i18n';

export interface ModelDescriptor {
  id: ModelId;
  repository: string;
  /** Tamanho aproximado dos arquivos ONNX quantizados em GB/MB. */
  downloadApprox: string;
  ramApprox: string;
  nameKey: TranslationKey;
  hintKey: TranslationKey;
}

export const MODELS: readonly ModelDescriptor[] = [
  {
    id: 'tiny',
    repository: 'Xenova/whisper-tiny',
    downloadApprox: '~40 MB',
    ramApprox: '~500 MB',
    nameKey: 'settings.model.tiny',
    hintKey: 'settings.model.tiny.hint',
  },
  {
    id: 'base',
    repository: 'Xenova/whisper-base',
    downloadApprox: '~145 MB',
    ramApprox: '~1 GB',
    nameKey: 'settings.model.base',
    hintKey: 'settings.model.base.hint',
  },
  {
    id: 'small',
    repository: 'Xenova/whisper-small',
    downloadApprox: '~500 MB',
    ramApprox: '~2 GB',
    nameKey: 'settings.model.small',
    hintKey: 'settings.model.small.hint',
  },
];

export function getModel(id: ModelId): ModelDescriptor {
  return MODELS.find((model) => model.id === id) ?? MODELS[1]!;
}

/**
 * Modelos multilíngues: o idioma de saída é sempre o idioma falado.
 * A interface (pt/en/es) não influencia o reconhecimento.
 */
export const WHISPER_LANGUAGES = [
  'portuguese', 'english', 'spanish', 'french', 'german', 'italian', 'dutch',
  'japanese', 'chinese', 'korean', 'hindi', 'arabic', 'russian', 'swedish',
  'danish', 'finnish', 'norwegian', 'turkish', 'polish', 'ukrainian', 'czech',
  'hungarian', 'romanian', 'greek', 'hebrew', 'thai', 'vietnamese', 'indonesian',
] as const;
