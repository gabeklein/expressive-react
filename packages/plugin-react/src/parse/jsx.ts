import * as t from '@babel/types';
import { ParseErrors } from 'errors';
import { Prop } from 'handle/attributes';
import { DefineElement } from 'handle/definition';
import { ElementInline } from 'handle/element';

import { parse } from './body';

import type { NodePath as Path } from '@babel/traverse';
import type {
  Expression,
  JSXAttribute,
  JSXElement,
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
  JSXSpreadAttribute
} from '@babel/types';
import type { Define } from 'handle/definition';

export type Element = ElementInline | Define;

const Oops = ParseErrors({
  InvalidPropValue: "Can only consume an expression or string literal as value here.",
  UnhandledChild: "Can't parse JSX child of type {1}",
  JSXMemberExpression: "Member Expression is not supported!",
  NonJSXIdentifier: "Cannot handle non-identifier!"
});

const COMMON_HTML = [
  "article", "blockquote", "input",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "a", "ul", "ol", "li",
  "i", "b", "em", "strong", "span",
  "hr", "img", "div", "br"
];

export function addElementFromJSX(
  path: Path<JSXElement>, parent: DefineElement){

  let target = parent as Element;
  const tag = path.get("openingElement").get("name");

  if(!tag.isJSXIdentifier({ name: "this" }))
    target = createElement(tag.node, target);

  const queue = [[target, path] as const];

  for(const [element, path] of queue){
    const children = path.get("children");
    const attributes = path.get("openingElement").get("attributes");

    for(const attribute of attributes)
      applyAttribute(element, attribute as any);

    children.forEach((path, index) => {
      if(path.isJSXElement()){
        queue.push([
          createElement(path.node.openingElement.name, element),
          path
        ]);
      }

      else if(path.isJSXText()){
        const { value } = path.node;

        if(/^\n+ *$/.test(value))
          return;

        let text = value
          .replace(/ +/g, " ")
          .replace(/\n\s*/, "");

        if(!index)
          text = text.trimLeft();

        if(index == children.length - 1)
          text = text.trimRight();

        element.adopt(t.stringLiteral(text));
      }

      else if(path.isJSXExpressionContainer())
        element.adopt(path.node.expression as Expression);

      else
        Oops.UnhandledChild(path, path.type);
    })
  }
}

function createElement(
  tag: JSXIdentifier | JSXMemberExpression | JSXNamespacedName,
  parent: Element){

  const target = new ElementInline(parent.context);
  let name;

  if(t.isJSXMemberExpression(tag)){
    name = tag.property.name;
    target.explicitTagName = tag;
  }
  else if(t.isJSXIdentifier(tag)){
    name = tag.name;

    if(name == "s")
      name = "span";

    let explicit =
      /^[A-Z]/.test(name) ||
      COMMON_HTML.includes(name);

    if(/^html-.+/.test(name)){
      name = name.slice(5);
      explicit = true;
    }

    if(explicit)
      target.explicitTagName = name;
  }
  else
    throw Oops.NonJSXIdentifier(tag);

  target.name = name;
  target.uses(name);

  parent.adopt(target);

  return target;
}

function applyAttribute(
  parent: Element,
  attr: Path<JSXAttribute> | Path<JSXSpreadAttribute>){

  let name: string | false;
  let value: Expression | undefined;

  if(attr.isJSXSpreadAttribute()){
    const arg = attr.get("argument");

    if(arg.isDoExpression()){
      const define = new DefineElement(parent.context, parent.name!);
      parent.use(define);
      parse(define, arg, "body");
      return;
    }

    name = false;
    value = arg.node;
  }
  else {
    const expression = attr.node.value;
    name = attr.node.name.name as string;

    if(expression === null){
      parent.uses(name);
      return;
    }
  
    switch(expression.type){
      case "JSXExpressionContainer":
        value = expression.expression as Expression;
      break;
  
      case "StringLiteral":
        value = expression;
      break;
  
      default:
        throw Oops.InvalidPropValue(expression);
    }
  }

  parent.add(
    new Prop(name, value || null)
  );
}