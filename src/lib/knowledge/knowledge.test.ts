import { describe, expect, it } from 'vitest'
import { chunkText } from './chunks'
import { checksum, validateDocumentInput, validateText } from './validation'
import { canReadKnowledge, canWriteKnowledge } from './authorization'
describe('knowledge foundation',()=>{
  it('chunks deterministically with overlap',()=>{const text=Array.from({length:300},(_,i)=>`word${i}`).join(' ');const a=chunkText(text,{maxChars:200,overlapChars:20});const b=chunkText(text,{maxChars:200,overlapChars:20});expect(a).toEqual(b);expect(a.length).toBeGreaterThan(1);expect(a[0].checksum).toBe(checksum(a[0].content))})
  it('validates limits and source types',()=>{expect(validateDocumentInput({title:' Manual ',sourceType:'pdf'}).title).toBe('Manual');expect(()=>validateDocumentInput({title:'',sourceType:'pdf'})).toThrow();expect(()=>validateDocumentInput({title:'x',sourceType:'bad' as never})).toThrow();expect(()=>validateText('')).toThrow()})
  it('has account role policy',()=>{expect(canWriteKnowledge('admin')).toBe(true);expect(canWriteKnowledge('agent')).toBe(false);expect(canReadKnowledge('viewer')).toBe(true)})
  it('uses checksum for stable deduplication',()=>{expect(checksum('x')).toBe(checksum('x'));expect(checksum('x')).not.toBe(checksum('y'))})
})
