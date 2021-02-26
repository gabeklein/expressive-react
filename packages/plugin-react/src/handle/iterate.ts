import { arrowFunctionExpression, blockStatement, doExpression, expressionStatement, isBlockStatement } from '@babel/types';
import { generateElement } from 'generate';
import { ParseForLoop, parser } from 'parse';
import { meta } from 'shared';
import { _call, _get } from 'syntax';

import { ComponentContainer } from './';

import type { ElementInline } from 'handle';
import type { Statement, For } from '@babel/types';
import type { ForPath } from 'types';

export class ComponentFor extends ComponentContainer {
  parse = parser(ParseForLoop);
  name = "forLoop";

  node: For

  constructor(
    public path: ForPath,
    element: ElementInline){

    super(element.context);

    this.node = path.node;
    this.doBlock = this.handleContentBody(path.node.body);

    element.adopt(this);

    if(this.doBlock)
      path.replaceWith(this.doBlock);
  }

  toExpression(){
    const { node, statements } = this;
    const { Imports } = this.context;
    const accumulator = Imports.ensureUIDIdentifier("e");
    const content = Imports.container(generateElement(this));
    const collect = Imports.ensure("$runtime", "collect");
    const collector = expressionStatement(
      _call(_get(accumulator, "push"), content)
    );

    node.body = statements.length
      ? blockStatement([ ...statements, collector ])
      : node.body = collector;

    return _call(collect, 
      arrowFunctionExpression(
        [accumulator], blockStatement([ node ])
      )  
    )
  }

  handleContentBody(content: Statement){
    if(!isBlockStatement(content))
      content = blockStatement([content])

    const body = doExpression(content);
    meta(body, this);

    return body;
  }
}