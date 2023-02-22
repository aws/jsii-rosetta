import * as ts from 'typescript';

import { Spans } from './visible-spans';

export class SyntaxKindCounter {
  private readonly counter: Partial<Record<ts.SyntaxKind, number>>;

  public constructor(private readonly visibleSpans: Spans) {
    this.counter = {};
  }

  public countKinds(sourceFile: ts.SourceFile): Partial<Record<ts.SyntaxKind, number>> {
    this.countNode(sourceFile);
    return this.counter;
  }

  private countNode(node: ts.Node) {
    if (this.visibleSpans.containsStartOfNode(node)) {
      this.counter[node.kind] = (this.counter[node.kind] ?? 0) + 1;
    }

    // The two recursive options produce differing results. `ts.forEachChild()` ignores some unimportant kinds.
    // `node.getChildren()` goes through all syntax kinds.
    // see: https://basarat.gitbook.io/typescript/overview/ast/ast-tip-children
    ts.forEachChild(node, (x) => this.countNode(x));
  }
}
