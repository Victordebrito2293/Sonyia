import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const speechFixture = join(process.cwd(), 'tests/fixtures/1272-128104-0000.wav');

/**
 * Teste ponta a ponta com o modelo real: baixa Whisper tiny da Hugging Face
 * na primeira execução e executa toda a inferência dentro do navegador.
 * É deliberadamente lento e marcado com @asr.
 */
test('transcreve fala real localmente e exporta SRT com marcas de tempo @asr', async ({ page }) => {
  test.setTimeout(600_000);

  const posted: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') posted.push(`${request.method()} ${request.url()}`);
  });

  await page.goto('/');
  await page.locator('#model-select').selectOption('tiny');
  await page.setInputFiles('#file-input', speechFixture);
  await page.locator('#start-button').click();

  await expect(page.locator('#result-content')).toBeVisible({ timeout: 540_000 });
  const transcript = await page.locator('#transcript-editor').inputValue();
  expect(transcript.length).toBeGreaterThan(20);
  expect(transcript.toLowerCase()).toContain('quilter');
  await expect(page.locator('#meta-language')).toContainText('English');
  expect(posted).toEqual([]);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-format="srt"]').click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  const srt = readFileSync(path!, 'utf8');
  // Timestamps reais não precisam começar em zero: o VAD e o Whisper definem
  // os limites do trecho falado.
  expect(srt).toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
  expect(srt.toLowerCase()).toContain('quilter');

  await page.locator('#view-segments').click();
  await expect(page.locator('.segment-item').first()).toBeVisible();
});
