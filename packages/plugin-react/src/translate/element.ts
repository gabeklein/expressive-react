import {
  callExpression,
  Expression,
  isExpression,
  isStringLiteral,
  JSXMemberExpression,
  objectExpression,
  objectProperty,
  ObjectProperty,
  SpreadElement,
  spreadElement,
  stringLiteral,
} from '@babel/types';
import {
  Attribute,
  ComponentExpression,
  ComponentFor,
  ComponentIf,
  ContingentModifier,
  ElementInline,
  ElementModifier,
  ExplicitStyle,
  Prop,
} from 'handle';
import { StackFrame } from 'parse';
import { Shared } from 'shared';
import { AttributeStack, ElementIterate, ElementSwitch } from 'translate';
import { BunchOf, ContentLike, PropData, SequenceItem } from 'types';

export class ElementReact<E extends ElementInline = ElementInline> {

  source: E;
  context: StackFrame;
  children = [] as ContentLike[];
  props = [] as PropData[];
  classList = [] as Array<string | Expression>
  style = new AttributeStack<ExplicitStyle>();
  style_static = [] as ExplicitStyle[];

  get tagName(): string | JSXMemberExpression {
    const { name, explicitTagName } = this.source;
    return explicitTagName || (
      name && /^[A-Z]/.test(name) ? name : "div"
    );
  }

  constructor(source: E){
    this.source = source;
    this.context = source.context;
    this.parse(true);
  }

  parse(invariant?: boolean, overridden?: boolean){
    let { sequence } = this.source;

    const replace = this.willParse(sequence);
    
    if(replace)
      sequence = replace;

    for(const item of sequence as SequenceItem[]){
      if(item instanceof ComponentIf)
        this.Switch(item)

      else if(item instanceof ComponentFor)
        this.Iterate(item)

      else if(item instanceof ElementInline)
        this.Child(item);

      else if(item instanceof Attribute){
        if(!overridden && item.overridden
        || !invariant && item.invariant)
          continue;

        if(item instanceof ExplicitStyle)
          this.Style(item);
        else
        if(item instanceof Prop)
          this.Props(item);
      }

      else if(isExpression(item))
        this.Content(item);

      else
        this.Statement(item);
    }

    this.didParse();
  }

  didParse(){
    this.applyHoistedStyle();
    this.applyInlineStyle();
    this.applyClassname();
  }

  willParse(sequence: SequenceItem[]){
    const {
      style: elementStyle,
      modifiers
    } = this.source;

    const accumulator = {} as BunchOf<Attribute>;
    const inlineOnly = Shared.opts.styleMode === "inline";
    // TODO: respect priority differences!

    for(const mod of modifiers){
      if(mod.sequence.length === 0 && mod.alsoApplies.length === 0)
        continue;

      const collapsable =
        mod instanceof ElementModifier &&
        mod.hasTargets == 1 &&
        mod.onlyWithin === undefined &&
        mod.alsoApplies.length === 0;

      for(const style of mod.sequence)
        if(style instanceof ExplicitStyle){
          const { name, invariant } = style;
  
          if(!invariant
          || !name
          || inlineOnly
          || collapsable
          || name in elementStyle
          || name in accumulator &&
             !accumulator[name].overridden)
            continue;
  
          accumulator[name] = style;
        }

      if(!inlineOnly
      && !collapsable
      && mod instanceof ElementModifier)
        this.applyModifierAsClassname(mod);
    }

    for(const name in accumulator)
      elementStyle[name] = accumulator[name] as ExplicitStyle;

    const pre: SequenceItem[] = Object.values(accumulator);

    if(pre.length)
      return pre.concat(sequence);
  }

  applyModifierAsClassname(mod: ElementModifier){
    let doesProvideAStyle = false;
    const declared = this.context.Module.modifiersDeclared;

    for(const applicable of [mod, ...mod.alsoApplies]){
      if(applicable.sequence.length)
        declared.add(applicable);

      if(applicable instanceof ContingentModifier)
        doesProvideAStyle = true;
      else
      if(applicable instanceof ElementModifier)
        if(applicable.sequence.length)
          this.classList.push(applicable.uid);
    }

    if(doesProvideAStyle)
      declared.add(mod);
  }

  addProperty(
    name: string | false | undefined,
    value: Expression){

    this.props.push({ name, value });
  }

  protected adopt(item: ContentLike){
    this.children.push(item)
  }

  private applyHoistedStyle(){
    const { style_static, context, source } = this;

    if(style_static.length > 0){
      const mod = new ContingentModifier(context, source);
      const { name, uid } = source;

      const classMostLikelyForwarded =
        /^[A-Z]/.test(name!) &&
        !(source instanceof ComponentExpression);

      mod.priority = classMostLikelyForwarded ? 3 : 2;
      mod.sequence.push(...style_static);
      mod.forSelector = [ `.${uid}` ];
      context.Module.modifiersDeclared.add(mod);
    }
  }

  private applyInlineStyle(){
    const { style } = this;

    if(!style.length)
      return;

    let value: Expression;
    const [ head ] = style;

    if(style.length == 1 && head instanceof ExplicitStyle)
      value = head.toExpression();

    else {
      const chunks = [] as (ObjectProperty | SpreadElement)[];

      for(const item of style)
        if(item instanceof ExplicitStyle)
          chunks.push(spreadElement(item.toExpression()))
        else
          chunks.push(...item.map(style => {
            return objectProperty(
              stringLiteral(style.name!),
              style.toExpression()
            )
          }));

      value = objectExpression(chunks)
    }

    this.addProperty("style", value)
  }

  private applyClassname(){
    const {
      classList: list,
      context: { Imports },
      source
    } = this;

    if(source.hasOwnProperty("uid"))
      list.push(source.uid);

    if(!list.length)
      return;

    const selectors = [] as Expression[];
    let classList = "";

    for(const item of list)
      if(typeof item == "string")
        classList += " " + item;
      else
        selectors.push(item);

    if(classList)
      selectors.unshift(
        stringLiteral(classList.slice(1))
      )

    let computeClassname = selectors[0];

    if(selectors.length > 1){
      const join = Imports.ensure("$runtime", "join");
      computeClassname = callExpression(join, selectors)
    }

    this.addProperty("className", computeClassname)
  }

  Style(item: ExplicitStyle){
    if(Shared.opts.styleMode == "inline")
      (<any>item).invariant = false;

    if(item.invariant)
      this.style_static.push(item);
    else
      this.style.insert(item)
  }

  Props(item: Prop){
    switch(item.name){
      case "style": {
        const styleProp = item.toExpression();
        const spread = new ExplicitStyle(false, styleProp);
        this.style.push(spread);
        break;
      }

      case "className": {
        let { value } = item;

        if(value && typeof value == "object")
          if(isStringLiteral(value))
            value = value.value;
          else {
            this.classList.push(value as Expression);
            break;
          }

        if(typeof value == "string")
          this.classList.push(value.trim());
      } break;

      default:
        this.addProperty(item.name, item.toExpression());
    }
  }

  Child(item: ElementInline){
    this.adopt(new ElementReact(item));
  }

  Content(item: Expression){
    this.adopt(item);
  }

  Switch(item: ComponentIf){
    const fork = new ElementSwitch(item)

    if(item.hasElementOutput)
      this.adopt(fork)

    if(item.hasStyleOutput){
      this.classList.push(fork.toClassName());
    }
  }

  Iterate(item: ComponentFor){
    this.adopt(new ElementIterate(item))
  }

  Statement(item: any){
    void item;
  }
}