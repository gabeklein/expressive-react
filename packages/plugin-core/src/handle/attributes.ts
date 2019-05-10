import { NodePath as Path } from '@babel/traverse';
import { Expression, LabeledStatement } from '@babel/types';
import { ApplyModifier } from 'internal';
import { ParseErrors, quickHash } from 'shared';
import { BunchOf, FlatValue } from 'types';

import { ElementModifier, Modifier, TraversableBody } from './';

const Error = ParseErrors({
    ExpressionUnknown: "Unhandled expressionary statement of type {1}",
    NodeUnknown: "Unhandled node of type {1}",
    BadInputModifier: "Modifier input of type {1} not supported here!",
    BadModifierName: "Modifier name cannot start with _ symbol!",
    DuplicateModifier: "Duplicate declaration of named modifier!"
})

export abstract class AttributeBody extends TraversableBody {
    
    props = {} as BunchOf<Prop>;
    style = {} as BunchOf<ExplicitStyle>;
    
    insert(item: Prop | ExplicitStyle){
        const { name } = item;
        const accumulator = item instanceof Prop
            ? this.props : this.style;

        if(name){
            const existing = accumulator[name];
            if(existing) existing.overriden = true;
            accumulator[name] = item;
        }

        this.add(item);
    }

    get uid(){
        const hash = quickHash(this.context.prefix);
        return this.uid = this.name + "_" + hash;
    }

    set uid(uid: string){
        Object.defineProperty(this, "uid", { value: uid });
    }

    abstract ElementModifier(
        mod: Modifier
    ): void;

    LabeledStatement(
        path: Path<LabeledStatement>, 
        applyTo: Modifier = this as any){

        const { name } = path.node.label;
        const body = path.get("body");
    
        if(name[0] == "_")
            throw Error.BadModifierName(path)

        if(this.context.hasOwnProperty("_" + name))
            throw Error.DuplicateModifier(path); 

        const handler = applyTo.context.propertyMod(name);
    
        if(!handler && body.isBlockStatement())
            applyTo.ElementModifier(
                new ElementModifier(this.context, name, body)
            )

        else if(body.isExpressionStatement() || body.isBlockStatement() || body.isLabeledStatement())
            ApplyModifier(
                name, applyTo, body
            );

        else
            throw Error.BadInputModifier(body, body.type)
    }

    ExpressionDefault(path: Path<Expression>){
        throw Error.ExpressionUnknown(path, path.type);
    }
}

export abstract class Attribute<T extends Expression = Expression> {
    name?: string;
    overriden?: boolean;
    invariant?: boolean;
    value: FlatValue | T | undefined
    path?: Path<T>

    constructor(
        name: string | false,
        value: FlatValue | T | undefined, 
        path?: Path<T>){

        if(name) this.name = name;
        if(value) this.value = value;
        if(path) this.path = path;

        if(value === null || typeof value !== "object")
            this.invariant = true
    }
};

export class Prop extends Attribute {}
export class ExplicitStyle extends Attribute {}