/** Words in a document's text: runs of non-space characters. */
export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0
}
