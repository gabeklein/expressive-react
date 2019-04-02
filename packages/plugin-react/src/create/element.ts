import t, { Expression, JSXAttribute, JSXSpreadAttribute, ObjectProperty, SpreadElement, StringLiteral } from '@babel/types';
import {
    ComponentFor,
    ComponentIf,
    ElementConstruct,
    ElementInline,
    ExplicitStyle,
    Path,
    Prop,
    StackFrame,
} from '@expressive/babel-plugin-core';
import { ArrayStack, AttributeStack } from 'attributes';
import { Attributes, ContentReact, StackFrameExt, IterateElement, SwitchElement, ContentExpression, createElement } from 'internal';
import { AttributeES6, expressionValue, IsLegalAttribute } from 'syntax';

export class ElementReact<T extends ElementInline = ElementInline>
    extends ElementConstruct<T>{

    context: StackFrame
    statements = [] as any[];
    children = [] as ContentReact[];
    props = [] as Attributes[];
    classList = new ArrayStack<string, Expression>()
    style = new AttributeStack<ExplicitStyle>();
    style_static = [] as ExplicitStyle[];

    constructor(public source: T){
        super();
        this.context = source.context;
        this.parse(true);
    }

    toExpression(): Expression {
        return createElement(this)
    }

    didParse(){
        this.applyHoistedStyle();
        this.applyInlineStyle();
        this.applyClassname();
    }

    addProperty(
        name: string | false | undefined, 
        value: Expression){

        let attr: JSXAttribute | JSXSpreadAttribute;

        if(typeof name !== "string")
            attr = t.jsxSpreadAttribute(value);
        else {
            if(IsLegalAttribute.test(name) == false)
                throw new Error(`Illegal characters in prop named ${name}`)

            const insertedValue = 
                t.isStringLiteral(value)
                    ? value
                    : t.jsxExpressionContainer(value)

            attr = t.jsxAttribute(
                t.jsxIdentifier(name), 
                insertedValue
            )
        }
        
        this.props.push(attr);
    }

    get tagName(): string {
        const { name, explicitTagName } = this.source;
        return explicitTagName || name || "div";
    }

    protected adopt(item: ContentReact){
        this.children.push(item)
    }

    protected applyHoistedStyle(){
        const { style, style_static } = this;

        if(style_static.length == 0)
            return

        if(void 0){
            style.push(style_static as any);
            return;
        }

        const context = this.context as StackFrameExt;

        const reference = context.Module.registerStyle(context, style_static);

        if(typeof reference == "string")
            this.classList.insert(reference);
    }

    protected applyInlineStyle(){
        const { style } = this;

        if(!style.length)
            return;
            
        let value: Expression;
        const [ head ] = style;

        if(style.length == 1 && head instanceof ExplicitStyle)
            value = expressionValue(head);

        else {
            const stuff = [] as (ObjectProperty | SpreadElement)[];

            for(const item of style)
                if(item instanceof ExplicitStyle)
                    stuff.push(t.spreadElement(expressionValue(item)))
                else
                    stuff.push(...item.map(AttributeES6));
            
            value = t.objectExpression(stuff)
        }

        this.addProperty("style", value)
    }

    protected applyClassname(){
        if(!this.classList.length)
            return;

        const classes = this.classList.map(x => {
            return Array.isArray(x)
                ? t.stringLiteral(x.join(" "))
                : x
        })

        let classNameValue = 
            classes.length == 1
                ? classes[0] as StringLiteral
                : t.callExpression(
                    t.memberExpression(
                        t.arrayExpression(classes),
                        t.identifier("join")
                    ), [
                        t.stringLiteral(" ")
                    ]
                )

        this.addProperty("className", classNameValue)
    }

    Attribute(item: Prop | ExplicitStyle): boolean | undefined {
        if(item instanceof ExplicitStyle)
            return;

        switch(item.name){
            case "style":
                this.style.push(new ExplicitStyle(false, expressionValue(item)));
                break;

            case "className": {
                let { value } = item;

                if(!value && item.path)
                    value = item.path.node;

                if(value && typeof value == "object")
                    if(t.isStringLiteral(value))
                        value = value.value;
                    else {
                        this.classList.push(value);
                        break;
                    }

                if(typeof value == "string")
                    for(const name of value.split(" "))
                        this.classList.insert(name);
            } break;

            default:
                return;
        }

        return true;
    }

    Props(item: Prop){
        this.addProperty(item.name, expressionValue(item));
    }

    Style(item: ExplicitStyle){
        if(item.invariant)
            this.style_static.push(item as ExplicitStyle);
        else
            this.style.insert(item)
    }

    Child(item: ElementInline ){
        this.adopt(new ElementReact(item));
    }

    Content(item: Path<Expression> | Expression){
        this.adopt(new ContentExpression(item));
    }

    Switch(item: ComponentIf){
        this.adopt(new SwitchElement(item))
    }

    Iterate(item: ComponentFor){
        this.adopt(new IterateElement(item))
    }

    Statement(item: any){
        void item;
    }
}