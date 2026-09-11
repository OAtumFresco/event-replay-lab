import { test, expect, openLab, disconnect, reconnect, addEvents } from './fixture.js';

// Pauses make the verified states readable in the recording.
const hold = page => page.waitForTimeout(2500);
test('event replay and snapshot recovery demonstration', async ({ page, lab }) => {
  await openLab(page, lab);
  await hold(page);
  await disconnect(page);
  await addEvents(page, 3);
  await expect(page.locator('#server-value')).toHaveText('3');
  await expect(page.locator('#client-value')).toHaveText('0');
  await hold(page);
  await reconnect(page);
  await expect(page.locator('#client-value')).toHaveText('3');
  await expect(page.locator('#frame-count')).toHaveText('4');
  await hold(page);
  await disconnect(page);
  await page.getByRole('button', { name: 'Add 25 events', exact: true }).click();
  await expect(page.locator('#server-value')).toHaveText('28');
  await hold(page);
  await reconnect(page);
  await expect(page.locator('#client-value')).toHaveText('28');
  await expect(page.getByRole('status')).toContainText('history-expired');
  await hold(page);
});
