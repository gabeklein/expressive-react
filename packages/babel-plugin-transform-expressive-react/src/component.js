const t = require("babel-types")
const { Opts, transform, Shared } = require("./shared")

const UNARY_NAMES = {
    "~": "Tilde",
    "+": "Positive",
    "-": "Negitive",
    "!": "Anti"
}

class TraversableBody {

    children = [];

    add(obj){
        const { inlineType } = obj;
        if(this[inlineType])
            this[inlineType].push(obj);
        this.children.push(obj);
    }

    bubble(fnName, ...args){
        let cd = this;
        while(cd = cd.parent)
            if(fnName in cd){
                const result = cd[fnName](...args); 
                if(result !== false) return result;
            }
        throw new Error(`No method named ${fnName} in parent-chain of element ${this.constructor.name}`)
    }

    insertDoIntermediate(path, node){
        const doTransform = t.doExpression(node || path.node);

        doTransform.meta = this;
        this.doTransform = doTransform;

        path.replaceWith(
            t.expressionStatement(doTransform)
        )
    }

    didEnterOwnScope(path){
        Shared.stack.push(this);
        
        if(typeof this.init == "function")
            this.init(path);

        const src = path.get("body.body")
        for(const item of src)
            if(item.type in this) 
                this[item.type](item);
            else throw item.buildCodeFrameError(`Unhandled node ${item.type}`)
    }

    didExitOwnScope(){
        this.context.pop();
    }

    //  Node Type Specifiers

    ExpressionStatement(path){
        const expr = path.get("expression")
        if(expr.type in this) this[expr.type] (expr);
        else if(this.ExpressionDefault) this.ExpressionDefault(expr);
        else throw expr.buildCodeFrameError(`Unhandled expressionary statement of type ${expr.type}`)
        
    }

    UnaryExpression(path){
        const arg = path.get("argument");
        const type = UNARY_NAMES[path.node.operator] + "Expression";
        if(type in this) this[type] (arg);
        else throw arg.buildCodeFrameError(`Unhandled Unary statement of type ${type}`);   
    }

}

export class AttrubutesBody extends TraversableBody {

    constructor() {
        super();
        this.props = [];
        this.style = this.style_static = []
    }

    LabeledStatement(path){
        HandleModifier(path, this);
    }

    AssignmentExpression(path){
        Prop.applyTo(this, path)
    }

    computeStyles(){
        let { style_static: style, classname } = this;
        return (
            `.${classname} { ${ style.map(x => x.asString).join("") }}`
        )
    }

}

export class ComponentBody extends AttrubutesBody {

    child = [];

    static enter(path, state){

        let { node } = path,
            { meta } = node;

        if(node.expressive_visited) return

        if(!meta){

            let immediateParent = path.parentPath;
            let Handler = ComponentInlineExpression;

            if(immediateParent.isArrowFunctionExpression()){
                Handler = ComponentFunctionExpression;
                immediateParent = immediateParent.parentPath;
            } else debugger

            let { type, node: parent } = immediateParent;
            let name;

            if(type == "ExportDefaultDeclaration")
                name = "default"
            else if(type == "ReturnStatement")
                name = "returned"
            else {
                name = parent[{
                    VariableDeclarator: "id",
                    AssignmentExpression: "left",
                    AssignmentPattern: "left",
                    ObjectProperty: "key"
                }[type]].name
            }

            meta = node.meta = new Handler(path, name)
        }
 
        meta.didEnterOwnScope(path)

        state.expressive_used = true;
    }

    static exit(path, state){
        const { node } = path;
        
        if(node.expressive_visited) return
        else node.expressive_visited = true;

        if(!node.meta) debugger

        node.meta.didExitOwnScope(path)
    }

    ExpressionDefault(path){
        CollateInlineComponentsTo(this, path)
    }

    StringLiteral(path){
        ChildNonComponent.applyTo(this, path)
    }

    ArrayExpression(path){
        ChildNonComponent.applyMultipleTo(this, path)
    }

    EmptyStatement(path){ 
        ChildNonComponent.applyVoidTo(this)
    };

    IfStatement(path){
        ComponentSwitch.applyTo(this, path)
    }

    ForStatement(path, mod){
        ComponentRepeating.applyTo(this, path, mod)
    }

    ForInStatement(path){
        this.ForStatement(path, "in")
    }

    ForOfStatement(path){
        this.ForStatement(path, "of")
    }
    
}

export class ComponentGroup extends ComponentBody {

    stats = []
    precedent = 0;

    add(obj){
        const updated = obj.precedence || 4;

        if(this.precedent > updated) this.flagDisordered();
        else if(updated < 4) this.precedent = updated;

        super.add(obj)
    }

    flagDisordered(){
        //disable check since no longer needed
        this.add = super.add;

        this.disordered = true;
        this.doesHaveDynamicProperties = true;
    }

    collateChildren(onAppliedType){

        const { scope } = this;
        const body = [];
        const output = [];
        let adjacent;
        if(!scope) debugger

        const child_props = [];

        function flushInline(done) {
            if(adjacent == null) return;

            if(done && !output.length){
                output.push(...adjacent)
                return;
            }

            const name = scope.generateUidIdentifier("e");
            let ref, stat;

            if(adjacent.length > 1) {
                stat = transform.declare("const", name, t.arrayExpression(adjacent))
                ref  = t.spreadElement(name)
            } else {
                stat = transform.declare("const", name, adjacent[0])
                ref  = name
            }

            body.push(stat)
            output.push(ref)

            adjacent = null;
        }

        for(const item of this.children) 
            switch(item.inlineType){

                case "self":
                case "child": {
                    const { product, factory } = item.transform();

                    if(!factory){
                        if(adjacent) adjacent.push(product);
                        else adjacent = [product]
                        continue;
                    } else {
                        flushInline();
                        output.push(product);
                        body.push(...factory)
                    }
                    
                } break;
                
                case "stats": {
                    flushInline();
                    const out = item.output()
                    if(out) body.push(out)

                } break;

                case "attrs": 
                    break;

                default: 
                    if(onAppliedType){
                        const add = onAppliedType(item);
                        if(add){
                            flushInline();
                            body.push(add);
                        }
                    }
            }
        
        flushInline(true);

        return { output, body }
    }

    VariableDeclaration(path){ 
        Statement.applyTo(this, path, "var")
    }

    DebuggerStatement(path){ 
        Statement.applyTo(this, path, "debug")
    }

    BlockStatement(path){ 
        Statement.applyTo(this, path, "block")
    }
}

//import last. modules here themselves import from this one, so exports must already be initialized.

const { Prop, Statement, ChildNonComponent } = require("./item");
const { CollateInlineComponentsTo } = require("./inline");
const { ComponentSwitch } = require("./ifstatement");
const { ComponentRepeating } = require("./forloop");
const { ComponentInlineExpression, ComponentFunctionExpression } = require("./entry");
const { HandleModifier } = require("./modifier");