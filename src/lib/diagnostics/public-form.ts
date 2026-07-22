import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export const hashDiagnosticToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const issueDiagnosticToken = () => randomBytes(32).toString('base64url');
export async function findPublicForm(token: string) {
  return admin.from('commercial_diagnostic_forms').select('id,title,questions,status,expires_at').eq('token_hash', hashDiagnosticToken(token)).maybeSingle();
}
export { admin as diagnosticAdmin };
