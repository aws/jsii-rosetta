import { DOMParser, MIME_TYPE, XMLSerializer } from '@xmldom/xmldom';
import * as cm from 'commonmark';

import { makeXmlEscaper } from './escapes';
import { prefixLines, RendererContext } from './markdown';
import { MarkdownRenderer, para, stripPara } from './markdown-renderer';

const ESCAPE = makeXmlEscaper();

/**
 * A renderer that will render a CommonMark tree to .NET XML comments
 *
 * Mostly concerns itself with code annotations and escaping; tags that the
 * XML formatter doesn't have equivalents for will be rendered back to MarkDown.
 */
export class CSharpXmlCommentRenderer extends MarkdownRenderer {
  public override block_quote(_node: cm.Node, context: RendererContext) {
    return para(prefixLines('    ', stripPara(context.content())));
  }

  public override code(node: cm.Node, _context: RendererContext) {
    return `<c>${ESCAPE.text(node.literal)}</c>`;
  }

  public override code_block(node: cm.Node, _context: RendererContext) {
    return para(`<code><![CDATA[\n${node.literal}]]></code>`);
  }

  public override text(node: cm.Node, _context: RendererContext) {
    return ESCAPE.text(node.literal) ?? '';
  }

  public override link(node: cm.Node, context: RendererContext) {
    return `<a href="${ESCAPE.attribute(node.destination) ?? ''}">${context.content()}</a>`;
  }

  public override image(node: cm.Node, context: RendererContext) {
    return `<img alt="${ESCAPE.text2attr(context.content())}" src="${ESCAPE.attribute(node.destination) ?? ''}" />`;
  }

  public override emph(_node: cm.Node, context: RendererContext) {
    return `<em>${context.content()}</em>`;
  }

  public override strong(_node: cm.Node, context: RendererContext) {
    return `<strong>${context.content()}</strong>`;
  }

  public override heading(node: cm.Node, context: RendererContext) {
    return para(`<h${node.level}>${context.content()}</h${node.level}>`);
  }

  public override list(node: cm.Node, context: RendererContext) {
    const listType = node.listType === 'bullet' ? 'bullet' : 'number';

    return para(`<list type="${listType}">\n${context.content()}</list>`);
  }

  public override item(_node: cm.Node, context: RendererContext) {
    return `<description>${stripPara(context.content())}</description>\n`;
  }

  public override thematic_break(_node: cm.Node, _context: RendererContext) {
    return para('<hr />');
  }

  /**
   * HTML needs to be converted to XML
   *
   * If we don't do this, the parser will reject the whole XML block once it sees an unclosed
   * <img> tag.
   */
  public override html_inline(node: cm.Node, _context: RendererContext) {
    const html = node.literal ?? '';
    try {
      // An html string fails to parse unless it is wrapped into a document root element
      // We fake this, by wrapping the inline html into an artificial root element,
      // and for rendering only selecting its children.
      const dom = new DOMParser().parseFromString(`<jsii-root>${html}</jsii-root>`, MIME_TYPE.HTML);
      const fragment = dom.createDocumentFragment();
      for (const child of Array.from(dom.firstChild?.childNodes ?? [])) {
        fragment.appendChild(child);
      }
      return new XMLSerializer().serializeToString(fragment);
    } catch {
      // Could not parse - we'll escape unsafe XML entities here...
      return html.replace(/[<>&]/g, (char: string) => {
        switch (char) {
          case '&':
            return '&amp;';
          case '<':
            return '&lt;';
          case '>':
            return '&gt;';
          default:
            return char;
        }
      });
    }
  }

  /**
   * HTML needs to be converted to XML
   *
   * If we don't do this, the parser will reject the whole XML block once it sees an unclosed
   * <img> tag.
   */
  public override html_block(node: cm.Node, context: RendererContext) {
    return this.html_inline(node, context);
  }
}
