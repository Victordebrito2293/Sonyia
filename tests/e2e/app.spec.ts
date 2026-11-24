import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixture = (name: string) => join(process.cwd(), 'tests/fixtures', name);

// O app segue o idioma do navegador; fixamos pt-BR para asserções determinísticas.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('sonyia.locale')) localStorage.setItem('sonyia.locale', 'pt-BR');
  });
});

test('carrega a aplicação sem requisições externas nem telemetria', async ({ page }, testInfo) => {
  const external: string[] = [];
  const base = testInfo.project.use.baseURL as string;
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
    }
  });

  await page.goto('/');
  await expect(page.locator('.brand-name')).toContainText('Sonyia');
  await expect(page.locator('h1')).not.toBeEmpty();
  await expect(page.locator('#result-empty')).toBeVisible();
  await expect(page.locator('#start-button')).toBeDisabled();
  expect(external).toEqual([]);
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').count()).toBe(1);
});

test('alterna tema e idioma sem recarregar, persistindo as preferências', async ({ page }) => {
  await page.goto('/');
  const initial = await page.locator('html').getAttribute('data-theme');
  await page.locator('#theme-toggle').click();
  const toggled = await page.locator('html').getAttribute('data-theme');
  expect(toggled).not.toBe(initial);
  expect(await page.evaluate(() => localStorage.getItem('sonyia.theme'))).toBe(toggled);

  await page.locator('#locale-select').selectOption('es');
  await expect(page.locator('#upload-title')).toHaveText('Importar archivos');
  expect(await page.locator('html').getAttribute('lang')).toBe('es');
  expect(await page.evaluate(() => localStorage.getItem('sonyia.locale'))).toBe('es');

  await page.reload();
  await expect(page.locator('#upload-title')).toHaveText('Importar archivos');
  expect(await page.locator('html').getAttribute('data-theme')).toBe(toggled);
});

test('seleciona e remove arquivo pelo seletor nativo', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#file-input', fixture('1272-128104-0000.wav'));
  await expect(page.locator('#file-card')).toBeVisible();
  await expect(page.locator('#file-name')).toHaveText('1272-128104-0000.wav');
  await expect(page.locator('#start-button')).toBeEnabled();
  await page.locator('#remove-file').click();
  await expect(page.locator('#drop-zone')).toBeVisible();
  await expect(page.locator('#start-button')).toBeDisabled();
});

test('aceita arrastar e soltar um WAV real', async ({ page }) => {
  await page.goto('/');
  const base64 = readFileSync(fixture('silence.wav')).toString('base64');
  await page.evaluate((data) => {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], 'arrastado.wav', { type: 'audio/wav' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const zone = document.getElementById('drop-zone');
    zone?.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
    zone?.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, base64);
  await expect(page.locator('#file-name')).toHaveText('arrastado.wav');
});

test('rejeita formato não suportado e arquivo corrompido com mensagem real', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#file-input', {
    name: 'documento.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not media'),
  });
  await expect(page.locator('#upload-error')).toBeVisible();
  await expect(page.locator('#start-button')).toBeDisabled();

  await page.setInputFiles('#file-input', {
    name: 'falso.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('conteudo que nao e wav'),
  });
  await expect(page.locator('#upload-error')).toContainText('corrompido');
});

test('permite cancelar o processamento em andamento', async ({ page }) => {
  await page.goto('/');
  // Mantém a decodificação em andamento por tempo suficiente para que o
  // clique no botão de cancelar seja determinístico mesmo sob carga paralela.
  await page.route('**/ffmpeg/ffmpeg-core.wasm', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.continue();
  });
  await page.setInputFiles('#file-input', fixture('silence.wav'));
  await page.locator('#start-button').click();
  await expect(page.locator('#progress-panel')).toBeVisible();
  await expect(page.locator('#cancel-button')).toBeEnabled();
  await page.locator('#cancel-button').click();
  await expect(page.locator('#toast')).toContainText('cancelado');
  await expect(page.locator('#start-button')).toBeEnabled();
});

test('mantém layout responsivo sem rolagem horizontal', async ({ page }) => {
  await page.goto('/');
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `overflow em ${size.width}px`).toBeLessThanOrEqual(1);
  }
});
