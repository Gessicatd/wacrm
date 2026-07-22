import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllKommoContacts, normalizeKommoContact } from './kommo';
afterEach(() => vi.unstubAllGlobals());
describe('Kommo contact import', () => {
  it('maps email and phone custom fields without persisting raw payload', () => {
    expect(normalizeKommoContact({ name: 'Ana', custom_fields_values: [{ field_name: 'Email', values: [{ value: ' ANA@EXAMPLE.COM ' }] }, { field_name: 'Telefone', values: [{ value: '+55 85 9999' }] }] })).toEqual({ name: 'Ana', email: 'ana@example.com', phone: '+55 85 9999', company: null });
  });
  it('paginates using the Kommo HAL next link', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { contacts: [{ id: 1 }] }, _links: { next: { href: 'https://empresa.kommo.com/api/v4/contacts?page=2' } } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ _embedded: { contacts: [{ id: 2 }] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAllKommoContacts('token', 'empresa')).resolves.toEqual({ contacts: [{ id: 1 }, { id: 2 }], pages: 2 });
  });
});
