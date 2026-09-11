import { test, expect, openLab, disconnect, reconnect, addEvents } from './fixture.js';

test('manual reconnection receives only the three missing events', async ({ page, lab }) => {
  await openLab(page, lab);
  await disconnect(page);
  await addEvents(page, 3);
  await expect(page.locator('#server-value')).toHaveText('3');
  await expect(page.locator('#client-value')).toHaveText('0');
  await reconnect(page);
  await expect(page.locator('#client-value')).toHaveText('3');
  await expect(page.locator('#frame-count')).toHaveText('4');
  await expect(page.locator('#frames li')).toHaveText([
    'Event 3 · +1 → 3', 'Event 2 · +1 → 2', 'Event 1 · +1 → 1', 'Snapshot at 0 · initial',
  ]);
});

test('expired history replaces state with one snapshot', async ({ page, lab }) => {
  await openLab(page, lab);
  await disconnect(page);
  await page.getByRole('button', { name: 'Add 25 events', exact: true }).click();
  await expect(page.locator('#server-value')).toHaveText('25');
  await expect(page.locator('#client-value')).toHaveText('0');
  await reconnect(page);
  await expect(page.locator('#client-value')).toHaveText('25');
  await expect(page.locator('#frame-count')).toHaveText('2');
  await expect(page.locator('#frames li').first()).toHaveText('Snapshot at 25 · history-expired');
});

test('automatic reconnect recognizes a restarted server instead of reusing the old sequence', async ({ page, lab }) => {
  await openLab(page, lab);
  await addEvents(page, 2);
  await expect(page.locator('#client-value')).toHaveText('2');
  const previousCursor = await page.locator('#cursor').textContent();
  await lab.stop();
  await expect(page.getByRole('status')).toContainText('Connection interrupted.');
  await lab.start();
  await expect(page.locator('#client-value')).toHaveText('0');
  await expect(page.locator('#frames li').first()).toHaveText('Snapshot at 0 · stream-changed');
  expect(await page.locator('#cursor').textContent()).not.toBe(previousCursor);
});

test('two subscribers maintain independent cursors', async ({ page, context, lab }) => {
  await openLab(page, lab);
  const second = await context.newPage();
  await openLab(second, lab);
  await disconnect(page);
  await addEvents(second, 2);
  await expect(second.locator('#client-value')).toHaveText('2');
  await expect(page.locator('#client-value')).toHaveText('0');
  await reconnect(page);
  await expect(page.locator('#client-value')).toHaveText('2');
  await expect(page.locator('#frame-count')).toHaveText('3');
});

test('a narrow viewport keeps connection controls usable', async ({ page, lab }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLab(page, lab);
  await addEvents(page, 1);
  await expect(page.locator('#client-value')).toHaveText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
