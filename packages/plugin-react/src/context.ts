import { NodePath as Path } from '@babel/traverse';
import { Program } from '@babel/types';
import { ComponentExpression, ComponentIf, ElementInline, ElementModifier, Modifier } from 'handle';
import { ExternalsManager, GenerateReact, ImportManager, RequireManager } from 'regenerate';
import { DEFAULTS, hash, Stack } from 'shared';
import { BabelState, BunchOf, ModifyAction, Options } from 'types';

type Stackable = { context: StackFrame };

export class StackFrame {
  modifiersDeclared = new Set<Modifier>();
  opts: Options;

  prefix: string;
  styleRoot = {} as any;
  stateSingleton: BabelState;
  ModifierQuery?: string;
  
  current = {} as any;
  currentComponent?: ComponentExpression;
  currentElement?: ElementInline;
  parentIf?: ComponentIf;
  currentIf?: ComponentIf;

  modifiers = new Stack<ElementModifier>();
  handlers = new Stack<ModifyAction>();

  Generator: GenerateReact;
  Imports: ExternalsManager;

  get parent(){
    return Object.getPrototypeOf(this);
  }

  constructor(path: Path<Program>, state: BabelState){
    const opts = { ...DEFAULTS, ...state.opts };

    this.current = state;
    this.stateSingleton = state;
    this.prefix = hash(state.filename);
    this.scope = path.scope;
    this.opts = opts;

    const Importer =
      opts.useRequire || opts.output == "js"
        ? RequireManager
        : ImportManager;

    this.Imports = new Importer(path, this);
    this.Generator = new GenerateReact(this);
  }

  including(modifiers: BunchOf<any>[]): this {
    let context = this;

    for(const imports of modifiers){
      const { Helpers, ...Modifiers } = imports as any;

      context = Object.create(context)

      for(const name in Modifiers)
        context.handlers.set(name, Modifiers[name]);
    }

    return context;
  }

  create(node: Stackable): StackFrame {
    const frame: StackFrame = Object.create(this);

    frame.current = node;
    if(node instanceof ElementInline)
      frame.currentElement = node;

    frame.handlers = frame.handlers.stack();
    frame.modifiers = frame.modifiers.stack();

    return frame;
  }

  push(){
    this.stateSingleton.context = this;
  }

  pop(meta: ElementInline){
    const state = this.stateSingleton;
    let { context } = state;
    let newContext: StackFrame | undefined;

    while(true){
      newContext = Object.getPrototypeOf(context);
      if(!newContext)
        break;
      if(context.current === meta)
        break;
      context = newContext;
    }

    if(context.current)
      state.context = newContext!;
    else
      console.error("StackFrame shouldn't bottom out like this");
  }

  unique(name: string){
    return name + "_" + hash(this.prefix);
  }

  resolveFor(append?: string | number){
    this.prefix = `${this.prefix} ${append || ""}`;
  }

  getHandler(named: string, ignoreOwn = false){
    let context = this;

    if(ignoreOwn)
      for(let found; !found;){
        found = context.handlers.has(named);
        context = context.parent;
      }

    return this.handlers.get(named);
  }

  elementMod(name: string): ElementModifier;
  elementMod(set: ElementModifier): void;
  elementMod(mod: string | ElementModifier){
    const stack = this.modifiers;

    if(typeof mod == "string")
      return stack.get(mod);
    else {
      const name = mod.name!;

      if(stack.get(name))
        mod.next = stack.get(name);

      stack.set(name, mod);
    }
  }
}
