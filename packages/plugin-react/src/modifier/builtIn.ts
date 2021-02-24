import {
  identifier,
  isIdentifier,
  isObjectPattern,
  objectPattern,
  objectProperty,
  variableDeclaration,
  variableDeclarator,
} from '@babel/types';
import { ElementInline, Modifier, Prop } from 'handle';

import type { Identifier } from '@babel/types';
import type { ComponentExpression } from 'handle/entry';
import type { BunchOf } from 'types';

import type { ModifyDelegate } from './delegate';

export function use(
  this: ModifyDelegate,
  ...args: any[]){

  const { target } = this;
  for(const item of args){
    if(typeof item !== "string")
      continue;

    const mod = target.context.elementMod(item);
    if(!mod)
      continue;

    if(target instanceof ElementInline)
      target.modifiers.push(mod);
    else
    if(target instanceof Modifier)
      target.alsoApplies.push(mod);
  }
}

export function priority(
  this: ModifyDelegate,
  priority: number){

  const { target } = this;
  if(target instanceof Modifier)
    target.priority = priority
}

export function css(this: ModifyDelegate){
  debugger;
}

export function forward(this: ModifyDelegate, ...args: any[]){
  const target = this.target;
  const parent = target.context.currentComponent;

  if(!(target instanceof ElementInline))
    throw new Error("Can only forward props to another element");

  if(!parent)
    throw new Error("No parent component found in hierarchy");

  if(!parent.exec)
    throw new Error("Can only apply props from a parent `() => do {}` function!");

  const all = args.indexOf("all") + 1;
  const reference = {} as BunchOf<Identifier>;

  if(all || ~args.indexOf("children")){
    const id = reference["children"] = this.identifier("children");
    target.adopt(id);
  }

  for(const prop of ["className", "style"])
    if(all || ~args.indexOf(prop)){
      const id = reference[prop] = this.identifier(prop);
      target.insertProp(
        new Prop(prop, id)
      )
    }

  applyToParentProps(parent, reference);
}

function applyToParentProps(
  parent: ComponentExpression,
  assignments: BunchOf<Identifier>){

  if(!parent.exec)
    throw new Error("Can only apply props from a parent `() => do {}` function!");

  const { params } = parent.exec.node;

  const properties = Object.entries(assignments).map(
    (e) => objectProperty(identifier(e[0]), e[1], false, e[1].name == e[0])
  )

  let props = params[0];

  if(!props)
    props = params[0] = objectPattern(properties);

  else if(isObjectPattern(props))
    props.properties.push(...properties)

  else if(isIdentifier(props))
    parent.statements.unshift(
      variableDeclaration("const", [
        variableDeclarator(objectPattern(properties), props)
      ])
    )
}