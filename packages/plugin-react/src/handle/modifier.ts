import { AttributeBody, ElementInline } from 'handle';

import type { NodePath as Path } from '@babel/traverse';
import type { Statement } from '@babel/types';
import type { StackFrame } from 'context';
import type { SelectionProvider } from 'types';

export abstract class Modifier extends AttributeBody {
  forSelector?: string[];
  onlyWithin?: ContingentModifier;
  priority?: number;

  alsoApplies = [] as Modifier[];
}

export class ElementModifier extends Modifier {
  name?: string;
  next?: ElementModifier;
  hasTargets = 0;

  provides = [] as ElementModifier[];
  priority = 1;

  constructor(
    context: StackFrame,
    name: string,
    body: Path<Statement>){

    super(context);
    this.name = name;
    this.context.resolveFor(name);
    this.forSelector = [ `.${this.uid}` ];
    this.parse(body);
  }

  ElementModifier(mod: ElementModifier){
    mod.priority = this.priority;
    this.provides.push(mod);
    this.onlyWithin = mod.onlyWithin;
  }
}

export class ContingentModifier extends Modifier {
  anchor: ElementModifier | ElementInline;

  constructor(
    context: StackFrame,
    parent: ContingentModifier | ElementModifier | ElementInline,
    contingent?: string | SelectionProvider
  ){
    super(context);

    let select;

    if(parent instanceof ElementInline)
      select = [ `.${parent.uid}` ];
    else {
      select = Object.create(parent.forSelector!);
      if(parent instanceof ContingentModifier)
        parent = parent.anchor;
    }

    if(typeof contingent == "function")
      contingent(select)
    else if(contingent)
      select.push(contingent);

    this.anchor = parent;
    this.forSelector = select;
  }

  ElementModifier(mod: ElementModifier){
    const { anchor } = this;

    mod.onlyWithin = this;
    mod.priority = 4;

    if(anchor instanceof ElementModifier)
      anchor.provides.push(mod)
    else
      anchor.context.elementMod(mod)
  }
}