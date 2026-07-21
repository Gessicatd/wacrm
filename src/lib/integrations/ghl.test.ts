import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllGhlContacts,
  hashGhlContact,
  hashPayload,
  normalizeGhlContact,
} from './ghl';

afterEach(() => vi.unstubAllGlobals());

describe('GoHighLevel contact import', () => {
  it('normalizes only the fields persisted in WACRM', () => {
    expect(
      normalizeGhlContact({
        firstName: ' Ana ',
        lastName: ' Lima ',
        email: ' ANA@EXAMPLE.COM ',
        phone: ' +55 85 9999-0000 ',
        companyName: ' Clínica A ',
      })
    ).toEqual({
      name: 'Ana Lima',
      email: 'ana@example.com',
      phone: '+55 85 9999-0000',
      company: 'Clínica A',
    });
  });

  it('uses a deterministic checksum and ignores unmapped payload changes', () => {
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
    expect(
      hashGhlContact({
        id: '1',
        name: 'Ana',
        email: 'ANA@example.com',
        tags: ['lead'],
      })
    ).toBe(
      hashGhlContact({
        id: '1',
        name: 'Ana',
        email: 'ana@example.com',
        tags: ['changed'],
      })
    );
  });

  it('loads every contacts page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            contacts: [{ id: '1' }],
            meta: {
              nextPageUrl:
                'https://services.leadconnectorhq.com/contacts/?startAfterId=1',
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ contacts: [{ id: '2' }], meta: {} }), {
          status: 200,
        })
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAllGhlContacts('token', 'location')).resolves.toEqual({
      contacts: [{ id: '1' }, { id: '2' }],
      pages: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects pagination URLs outside the GHL contacts API', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              contacts: [],
              meta: { nextPageUrl: 'https://attacker.example/steal' },
            }),
            { status: 200 }
          )
        )
    );
    await expect(fetchAllGhlContacts('token', 'location')).rejects.toThrow(
      'unsafe contacts pagination URL'
    );
  });
});
