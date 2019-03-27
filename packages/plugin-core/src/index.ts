import DoExpression from 'parse/doExpression';
import Program from 'parse/program';

export { 
    DoExpressive
} from "types"

export {
	ExplicitStyle,
    ElementInline,
    Prop,
    Syntax,
    ElementConstruct,
    ComponentExpression,
    ComponentConsequent,
    ComponentIf,
    ParseErrors
} from "internal";

export default (options: any) => {
    return {
        manipulateOptions: (options: any, parse: any) => {
            parse.plugins.push("decorators-legacy", "doExpressions")
        },
        visitor: {
            Program,
            DoExpression
        }
    }
}