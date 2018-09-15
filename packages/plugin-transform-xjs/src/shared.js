const t = require("@babel/types")

//basically a singleton
export const Shared = {
    set(data){
        Object.assign(this, data);
    }
}

export const env = process.env || {
    NODE_ENV: "production"
};

export const Opts = {}

export const transform = {

    IIFE(stats){
        return t.callExpression(
            t.arrowFunctionExpression([], 
                t.blockStatement(stats)
            ), []
        )
    },

    createFragment(elements){

        let type = Shared.stack.helpers.Fragment;
        
        if(Opts.output == "JSX"){
            type = t.jSXIdentifier(type.name);
            return t.jSXElement(
                t.jSXOpeningElement(type, []),
                t.jSXClosingElement(type), 
                elements.map( child => {
                    if(child.type == "StringLiteral")
                        return t.jSXText(child.value);
                    if(child.type == "JSXElement")
                        return child;
                    return t.jSXExpressionContainer(child);
                })
            )
        }

        return this.createElement(
            type, t.objectExpression([]), ...elements
        )
    },

    createElement(type, props, ...children){

        if(Opts.output == "JSX")
            return this.createJSXElement(type, props, children);

        if(typeof type == "string") type = t.stringLiteral(type);
        if(!props) props = t.objectExpression([]);

        return t.callExpression(Shared.stack.helpers.createElement, [type, props, ...children])
    },

    createJSXElement(type, props, children){
        if(type.type)
            type = type.value || type.name;

        type = t.jSXIdentifier(type);
        const selfClosing = children.length == 0;

        
        if(props.type == "CallExpression" && props.callee.name == "_flatten"){
            const flatten = [];
            for(const argument of props.arguments)
                if(argument.type == "ObjectExpression")
                    [].push.apply(flatten, argument.properties.map(x => {
                        let id, val;
                        if(x.key.type != "Identifier")
                            throw new Error("prop error, key isnt an identifier")
                        id = x.key.name;
                        val = x.value;
                        val = ~["StringLiteral", "JSXElement", "JSXFragment"].indexOf(val.type)
                            ? val : t.jsxExpressionContainer(val)

                        return t.jsxAttribute( t.jsxIdentifier(id), val );
                    }))
                else
                    flatten.push(t.jsxSpreadAttribute(argument));
            
            props = flatten;
        }
        else if(props.type == "Identifier")
            props = [ t.jSXSpreadAttribute(props) ];
        else if(!props.properties)
            props = [];
        else props = props.properties.map((x) => {

                let { key, value } = x;

                if(key.type == "Identifier")
                    key.type = "JSXIdentifier"
                else debugger;

                if(value.type != "StringLiteral" && value.type != "JSXElement")
                    value = t.jSXExpressionContainer(value);

                return t.jSXAttribute(key, value)
            })

        return t.jSXElement(
            t.jSXOpeningElement(type, props, selfClosing),
            selfClosing ? null : t.jSXClosingElement(type), 
            children.map( child => {
                if(child.type == "StringLiteral")
                    return t.jSXText(child.value);
                if(child.type == "JSXElement")
                    return child;
                if(child.type == "SpreadElement") 
                    return t.jsxExpressionContainer(
                        t.callExpression( Shared.stack.helpers.createIterated, [child.argument] )
                    )
                return t.jSXExpressionContainer(child);
            })
        )
    },

    element(){
        return {
            inlineType: "child",
            transform: () => ({
                product: this.createElement(...arguments)
            })
        }
    },

    object(obj){
        const properties = [];
        for(const x in obj)
            properties.push(
                t.objectProperty(
                    t.identifier(x),
                    obj[x]
                )
            )
        return t.objectExpression(properties);
    },

    member(object, ...path){
        if(object == "this") object = t.thisExpression()
        for(let x of path){
            if(typeof x == "string"){
                if(/^[A-Za-z0-9$_]+$/.test(x)){
                    object = t.memberExpression(object, t.identifier(x));
                    continue;
                }
                else x = t.stringLiteral(x)
            }
            else if(typeof x == "number")
                x = t.numericLiteral(x);

            object = t.memberExpression(object, x, true)
        }
        return object
    },

    declare(type, id, value){
        return (
            t.variableDeclaration(type, [
                t.variableDeclarator(id, value)
            ])
        )
    }

}