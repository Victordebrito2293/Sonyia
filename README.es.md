# Sonyia

Transcripción local, multilingüe y privada de audio y vídeo.

[Português](README.md) · [English](README.en.md) · [Español](README.es.md)

1. [Nombre](#1-nombre)
2. [Descripción](#2-descripción)
3. [Objetivo](#3-objetivo)
4. [Funcionalidades](#4-funcionalidades)
5. [Tecnologías](#5-tecnologías)
6. [Arquitectura](#6-arquitectura)
7. [Requisitos mínimos](#7-requisitos-mínimos)
8. [Ejecución local](#8-ejecución-local)
9. [Compilación](#9-compilación)
10. [Uso](#10-uso)
11. [GitHub Pages](#11-github-pages)
12. [Privacidad](#12-privacidad)
13. [Seguridad](#13-seguridad)
14. [Licencia](#14-licencia)
15. [Créditos](#15-créditos)
16. [Limitaciones conocidas](#16-limitaciones-conocidas)
17. [Contribución](#17-contribución)

## 1. Nombre

**Sonyia** — versión 1.0.0. Creado y desarrollado por Victor de Brito Brandão.

## 2. Descripción

Sonyia es una aplicación web que transcribe audio y vídeo **en el dispositivo del usuario**. No hay backend, clave de API, telemetría, rastreadores ni subida de archivos: el archivo seleccionado se decodifica y procesa en el navegador, y la transcripción resultante se puede editar y exportar localmente. La interfaz está disponible en portugués, inglés y español.

## 3. Objetivo

Ofrecer una forma práctica de obtener transcripciones con marcas de tiempo y detección automática de idioma sin depender de servicios externos, sin registro y sin exponer el contenido de los archivos. El proyecto prioriza la privacidad desde el diseño, la transparencia de licencias y el procesamiento completamente local tras la descarga inicial de los modelos.

## 4. Funcionalidades

- Decodificación local de archivos multimedia con `ffmpeg.wasm`, en un Web Worker.
- Remuestreo sinc a mono @16 kHz y normalización de pico en Rust compilado a WebAssembly.
- Detección de actividad de voz (VAD) heurística y determinista: energía (dBFS), tasa de cruces por cero, planitud espectral, flujo espectral y variación local, con histéresis y duración mínima.
- Transcripción con Whisper ONNX (`tiny`, `base`, `small`) mediante `@huggingface/transformers`, con opción de forzar un idioma.
- Detección automática del idioma hablado mediante trigramas locales (`franc`): se analiza el texto de la primera pasada y, si indica otro idioma, se repite la transcripción con el prompt correcto. Es una heurística determinista, no un modelo neural ni una garantía de precisión.
- Segmentos de voz con una puntuación heurística del VAD (no es una medida de precisión del reconocedor).
- Texto continuo y segmentado, edición manual del resultado y copia al portapapeles.
- Exportación local a TXT, SRT, VTT, JSON y PDF.
- Interfaz con tema claro/oscuro, idiomas pt-BR/en/es, etapas de progreso y cancelación.
- Sin cuenta, sin servidor, sin claves de API y sin telemetría.

## 5. Tecnologías

| Capa | Tecnología | Versión / licencia |
| --- | --- | --- |
| Interfaz y build | TypeScript + Vite | 5.9.3 (Apache-2.0) / 8.3.8 (MIT) |
| DSP local | Rust + `wasm-bindgen` (`sonyia-audio-engine`) | edición 2021, GPL-3.0-or-later |
| Reconocimiento | `@huggingface/transformers` + `onnxruntime-web` | 4.3.2 (Apache-2.0) / 1.31.1 (MIT) |
| Modelos | `Xenova/whisper-tiny`, `Xenova/whisper-base`, `Xenova/whisper-small` | Apache-2.0 |
| Detección de idioma | `franc` (trigramas locales) | 6.2.0 (MIT) |
| Decodificación multimedia | `@ffmpeg/ffmpeg` + `@ffmpeg/core` | 0.12.15 / 0.12.10 — GPL-2.0-or-later |
| PDF | `jspdf` | 4.2.1 (MIT) |
| Paralelismo | Web Workers (decodificación y transcripción) | API nativa del navegador |
| Pruebas | Vitest + happy-dom + Playwright | 5.1.1 / 21.0.4 / 1.65.1 |

Licencia general del proyecto: **GPL-3.0-or-later**, por causa de `@ffmpeg/core` (GPL-2.0-or-later). Las licencias de dependencias y modelos están documentadas en [docs/MODELS.md](docs/MODELS.md).

## 6. Arquitectura

```text
Archivo multimedia (File)
  └─ Worker de decodificación (ffmpeg.wasm) → PCM
       └─ Motor Rust/WASM (src/wasm): mono 16 kHz + normalización + VAD
            └─ Worker de transcripción (transformers.js + Whisper ONNX)
                 ├─ detección de idioma por trigramas en el texto (o idioma forzado)
                 └─ segmentos + texto → TXT / SRT / VTT / JSON / PDF
```

El hilo principal solo gestiona la interfaz, el progreso y la edición. El procesamiento pesado ocurre en Workers; ningún dato multimedia se envía por la red. Más detalles en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 7. Requisitos mínimos

- Node.js **>= 20.19** y npm (declarado en `package.json`).
- Navegador con WebAssembly, Web Workers, módulos ES y soporte moderno de `File`/`Blob`.
- Conexión a internet en la **primera ejecución**, para descargar el runtime y el modelo elegido desde Hugging Face. Después, mientras exista la caché del navegador, el procesamiento puede funcionar sin conexión.
- Memoria y espacio en disco acordes al modelo elegido (consulta [docs/MODELS.md](docs/MODELS.md)).
- Opcional, solo para recompilar el motor de audio: Rust stable, el objetivo `wasm32-unknown-unknown` y `wasm-pack`.

Chrome, Edge, Firefox y Safari son los navegadores objetivo de las pruebas. La compatibilidad real y los resultados por navegador se registran en el informe de validación; no declaramos compatibilidad universal sin pruebas.

## 8. Ejecución local

```bash
npm install
npm run assets          # copia artefactos estáticos (también se ejecuta en predev/prebuild)
npm run build:wasm      # opcional: recompila Rust → WASM (requiere wasm-pack)
npm run dev
```

El binario WASM ya incluido en `src/wasm/` permite desarrollar sin `wasm-pack`. Usa `npm run build:wasm` solo si modificas `rust/audio-engine`.

## 9. Compilación

```bash
npm run build           # tsc --noEmit && vite build
npm run preview         # sirve dist/ localmente
```

El resultado es un sitio estático en `dist/`. Para regenerar el motor de audio desde Rust:

```bash
npm run build:wasm      # requiere wasm-pack y el objetivo wasm32-unknown-unknown
```

## 10. Uso

1. Abre la aplicación y selecciona o arrastra un archivo de audio/vídeo.
2. Elige el modelo: `tiny` (ligero), `base` (equilibrado) o `small` (más recursos y tiempo).
3. Ajusta la sensibilidad del VAD y, si lo deseas, fuerza un idioma; por defecto se detecta automáticamente. El texto **no se traduce**.
4. Haz clic en **Transcribe** y sigue las etapas; puedes cancelar en cualquier momento.
5. Revisa y edita el texto, después expórtalo a TXT, SRT, VTT, JSON o PDF.

En la primera transcripción, el modelo se descarga desde Hugging Face y se guarda en la caché del navegador. Tamaños **estimados** de descarga: tiny ~40 MB, base ~145 MB, small ~500 MB. La aplicación no muestra porcentajes de precisión inventados; revisa siempre el resultado.

## 11. GitHub Pages

La compilación es estática. El workflow `.github/workflows/deploy-pages.yml` genera el motor WASM, compila el sitio y publica `dist/` en cada push a `main` (o cuando se dispara manualmente). Activa **Settings → Pages → Source: GitHub Actions** en el repositorio. Vite usa `base: './'`, por lo que el sitio funciona desde una subruta sin cambios de configuración. No se necesita servidor, base de datos ni variables de entorno. Las cabeceras y el comportamiento de WASM dependen de la plataforma de alojamiento: valida el resultado en el navegador y regístralo en el informe de validación.

## 12. Privacidad

Ningún archivo multimedia ni transcripción sale del dispositivo. El único tráfico externo es la descarga inicial del runtime y los modelos (además del propio sitio, cuando está alojado en la web). Las preferencias de tema e idioma son la única persistencia local de datos del usuario; los archivos y transcripciones viven en memoria y se descartan al cerrar la pestaña. Los artefactos descargados permanecen en la caché del navegador hasta que se borren manualmente. Consulta [docs/PRIVACY.md](docs/PRIVACY.md).

## 13. Seguridad

El proyecto adopta una CSP restrictiva, saneamiento de texto en la interfaz, validación de archivos por tipo y tamaño, límites de memoria, aislamiento en Workers y revocación explícita de `URL.createObjectURL`. Aun así existen riesgos residuales: el modelo proviene de una CDN externa en la primera ejecución, hay dependencias de terceros y cachés del navegador. **No afirmamos riesgo cero.** Informa de vulnerabilidades según [SECURITY.md](SECURITY.md) y [docs/SECURITY.md](docs/SECURITY.md).

## 14. Licencia

Sonyia se distribuye bajo **GPL-3.0-or-later**, por causa de `@ffmpeg/core` (GPL-2.0-or-later). Los modelos Whisper de Hugging Face son Apache-2.0; los demás componentes usan las licencias permisivas indicadas en la tabla de tecnologías. El archivo `LICENSE` se incluye en el repositorio.

## 15. Créditos

Creado y desarrollado por **Victor de Brito Brandão**. Agradecimientos a las comunidades detrás de Rust/WASM, Hugging Face, FFmpeg, ONNX Runtime, Vite y jsPDF. Los términos de modelos y dependencias se mantienen en [docs/MODELS.md](docs/MODELS.md).

## 16. Limitaciones conocidas

- El VAD es **heurístico y determinista**, no un clasificador neuronal; una sensibilidad alta puede incluir ruido.
- La música con voces, el canto y las voces superpuestas pueden generar errores u omitir fragmentos.
- Whisper puede alucinar texto durante silencios prolongados; el VAD lo mitiga, pero no lo elimina.
- Safari/iOS pueden presentar limitaciones con `ffmpeg.wasm` (memoria, decodificación, hilos).
- Los formatos admitidos solo se declaran después de las pruebas; los no validados deben considerarse experimentales.
- No hay diarización (identificación de hablantes) ni traducción.
- El PDF usa fuentes predeterminadas; no se garantiza la fidelidad tipográfica entre plataformas.
- No se ofrece una métrica de precisión porcentual: la puntuación mostrada es solo la confianza heurística del VAD.

## 17. Contribución

Las contribuciones son bienvenidas. Lee [CONTRIBUTING.md](CONTRIBUTING.md) y [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) para los estándares de código, el estilo de commits `feat`/`fix`/`docs`/`test` y el versionado semántico. Antes de abrir un PR:

```bash
npx playwright install chromium
npm run test:unit
npm run test:all
```
