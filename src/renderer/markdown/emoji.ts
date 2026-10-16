import { nameToEmoji } from 'gemoji'

// GitHub's emoji shortcodes: `:smile:` is shown as 😄, saved as `:smile:` (gemoji has the list).

/** The emoji a shortcode name stands for, or null when GitHub knows no such name. */
export function emojiOf(name: string): string | null {
  return Object.hasOwn(nameToEmoji, name) ? nameToEmoji[name] : null
}

const shortcode = /:([a-z0-9_+-]+):/g

export type EmojiPart = string | { name: string }

/** A line of text split into plain runs and the shortcodes GitHub would show as emoji. */
export function splitEmoji(text: string): EmojiPart[] {
  const parts: EmojiPart[] = []
  let last = 0
  for (const match of text.matchAll(shortcode)) {
    const name = match[1]
    if (emojiOf(name) === null) continue
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push({ name })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
