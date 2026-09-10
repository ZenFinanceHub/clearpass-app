import React from 'react';
import Markdown from 'react-native-markdown-display';

type MarkdownTextProps = {
  content: string;
  color: string;
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
};

/**
 * Renders AI-generated explanation text (Ask Pip, "Explain this answer") as markdown,
 * since the model doesn't always follow the "no markdown" instruction in its system
 * prompt. Headings are capped at bold-body size so they don't blow out small bubbles.
 */
export function MarkdownText({ content, color, fontFamily, fontSize, lineHeight }: MarkdownTextProps) {
  const headingStyle = { fontSize, lineHeight, color, fontFamily, fontWeight: '700' as const };

  return (
    <Markdown
      style={{
        body: { color, fontFamily, fontSize, lineHeight },
        paragraph: { marginTop: 0, marginBottom: 0 },
        heading1: headingStyle,
        heading2: headingStyle,
        heading3: headingStyle,
        heading4: headingStyle,
        heading5: headingStyle,
        heading6: headingStyle,
        strong: { fontWeight: '700' },
        em: { fontStyle: 'italic' },
        bullet_list: { marginVertical: 0 },
        ordered_list: { marginVertical: 0 },
        list_item: { marginVertical: 2 },
        code_inline: {
          fontSize: fontSize - 1,
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderWidth: 0,
          backgroundColor: 'rgba(0,0,0,0.06)',
        },
        code_block: { padding: 8, borderWidth: 0, backgroundColor: 'rgba(0,0,0,0.06)' },
        fence: { padding: 8, borderWidth: 0, backgroundColor: 'rgba(0,0,0,0.06)' },
        link: { color, textDecorationLine: 'underline' },
      }}
    >
      {content}
    </Markdown>
  );
}
