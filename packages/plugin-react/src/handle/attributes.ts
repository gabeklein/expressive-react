import { booleanLiteral, identifier, nullLiteral, numericLiteral, stringLiteral } from '@babel/types';
import { ParseAttributes, parser } from 'parse';

import type { Expression } from '@babel/types';
import type { StackFrame } from 'context';
import type { Modifier } from 'handle/modifier';
import type { ComponentIf } from 'handle/switch';
import type { BunchOf, FlatValue , SequenceItem } from 'types';

export abstract class AttributeBody {
  parse = parser(ParseAttributes);

  context: StackFrame
  name?: string;
  parent?: AttributeBody | ComponentIf;

  props = {} as BunchOf<Prop>;
  style = {} as BunchOf<ExplicitStyle>;
  sequence = [] as SequenceItem[];

  get uid(){
    const value = this.context.unique(this.name!)
    Object.defineProperty(this, "uid", { value });
    return value
  }

  abstract applyModifier(mod: Modifier): void;

  constructor(context: StackFrame){
    this.context = context.push(this);
  }

  wasAddedTo?<T extends AttributeBody>(element?: T): void;

  add(item: SequenceItem){
    this.sequence.push(item);

    if("wasAddedTo" in item && item.wasAddedTo)
      item.wasAddedTo(this);
  }

  insertProp(item: Prop){
    const { name } = item;
    const register = this.props

    if(name){
      const existing = register[name];

      if(existing)
        existing.overridden = true;

      register[name] = item;
    }

    this.add(item);

  }

  insertStyle(item: ExplicitStyle){
    const { name } = item;
    const register = this.style

    if(name){
      const existing = register[name];

      if(existing)
        existing.overridden = true;

      register[name] = item;
    }

    this.add(item);
  }

  addStyle(name: string, value: any){
    this.insertStyle(
      new ExplicitStyle(name, value)
    )
  }
}

export abstract class Attribute<T extends Expression = Expression> {
  name?: string;
  value: FlatValue | T | undefined

  /** May be ignored; another style took its place. */
  overridden?: boolean;

  /** Is a static value. May be hoisted and/or baked. */
  invariant?: boolean;

  constructor(
    name: string | false,
    value: FlatValue | T){

    if(name)
      this.name = name;
    if(value !== undefined)
      this.value = value;
    if(value === null || typeof value !== "object")
      this.invariant = true
  }

  get expression(){
    const { value } = this;
  
    switch(typeof value){
      case "string":
        return stringLiteral(value);
      case "number":
        return numericLiteral(value);
      case "boolean":
        return booleanLiteral(value);
      case "object":
        if(value === null)
          return nullLiteral();
        else
          return value;
      default:
        return identifier("undefined");
    }
  }
}

export class Prop extends Attribute {}

export class ExplicitStyle extends Attribute {
  constructor(
    name: string | false,
    value: FlatValue | Expression | FlatValue[],
    public important = false){

    super(name, flatten(value));

    function flatten(content: typeof value){
      if(Array.isArray(content)){
        const [ callee, ...args ] = content;
        return `${callee}(${args.join(" ")})`;
      }

      return content;
    }
  }
}