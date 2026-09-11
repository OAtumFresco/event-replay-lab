import { test as base, expect } from '@playwright/test';
import { once } from 'node:events';
import { createLabServer } from '../src/server.js';

export const test = base.extend({
  lab: async ({}, use) => {
    let current;
    let port = 0;
    const lab = {
      get url() { return `http://127.0.0.1:${port}`; },
      async start() {
        if (current) throw new Error('Server is already running');
        current = createLabServer();
        current.server.listen(port, '127.0.0.1');
        await once(current.server, 'listening');
        port = current.server.address().port;
      },
      async stop() {
        if (!current) return;
        const { server } = current;
        current = null;
        const closed = new Promise(resolve => server.close(resolve));
        server.closeAllConnections();
        await closed;
      },
    };
    try { await lab.start(); await use(lab); }
    finally { await lab.stop(); }
  },
});
export { expect };

export async function openLab(page, lab) {
  await page.goto(lab.url);
  await expect(page.locator('#client-value')).toHaveText('0');
  await expect(page.locator('#frame-count')).toHaveText('1');
}

export async function disconnect(page) {
  await page.getByRole('button', { name: 'Disconnect subscriber', exact: true }).click();
}

export async function reconnect(page) {
  await page.getByRole('button', { name: 'Reconnect subscriber', exact: true }).click();
}

export async function addEvents(page, count) {
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: 'Add one event', exact: true }).click();
  }
}
