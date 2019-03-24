/// <reference types="babel__traverse" />
/// <reference types="node" />
import { Path, VisitNodeObject as BabelVisitor } from '@babel/traverse';
import t, {
    ArrowFunctionExpression,
    AssignmentExpression,
    DoExpression,
    Expression,
    ExpressionStatement,
    For,
    IfStatement,
    LabeledStatement,
    Program,
    Statement,
    TemplateLiteral,
} from '@babel/types';

interface BunchOf<T> {
	[key: string]: T;
}
interface DoExpressive extends DoExpression {
	meta: ElementInline;
	expressive_visited?: true;
}
interface BabelState {
	context: StackFrame;
	opts: any;
}
interface ModifierOutput {
	attrs?: BunchOf<any>;
	style?: BunchOf<any>;
	props?: BunchOf<any>;
	installed_style?: (ElementModifier | ElementInline)[];
}
declare abstract class TraversableBody {
	sequence: unknown[];
	context: StackFrame;
	didEnter?(path?: Path): void;
	didExit?(path?: Path): void;
	constructor(context: StackFrame);
	parse(body: Path<Statement>): void;
	add(item: unknown): void;
	didEnterOwnScope(path: Path<DoExpressive>): void;
	didExitOwnScope(path: Path<DoExpressive>): void;
	ExpressionStatement(this: BunchOf<Function>, path: Path<ExpressionStatement>): void;
}
declare abstract class AttributeBody extends TraversableBody {
	props: BunchOf<Prop>;
	style: BunchOf<ExplicitStyle>;
	value: Expression;
	abstract generate(): Syntax;
	Prop(name: string | null, value: FlatValue | Expression | undefined, path?: Path<Expression>): void;
    Style(name: string | null, value: FlatValue | Expression, path?: Path<Expression>): void;
	ExpressionDefault(path: Path<Expression>): void;
	LabeledStatement(path: Path<LabeledStatement>): void;
}
declare class ElementInline extends AttributeBody {
	primaryName?: string;
	tagName?: string;
	multilineContent?: Path<TemplateLiteral>;
    children: InnerContent[];
	adopt(child: InnerContent): void;
	generate(): [Expression, (Statement[] | undefined)?];
	ExpressionDefault(path: Path<Expression>): void;
	AssignmentExpression(path: Path<AssignmentExpression>): void;
}
declare class ComponentExpression extends ElementInline {
	exec?: Path<ArrowFunctionExpression>;
	constructor(name: string, context: StackFrame, path: Path<DoExpressive>, exec?: Path<ArrowFunctionExpression>);
	didExitOwnScope(path: Path<DoExpressive>): void;
	private extractParams;
}
declare class ComponentConsequent extends ElementInline {
	replacement: Statement;
	logicalParent: ComponentIf;
	path: Path<Statement>;
	test?: Path<Expression>;
	constructor( 
		logicalParent: ComponentIf,
		path: Path<Statement>,
		test?: Path<Expression>
	)
}
declare class ComponentIf {
	children: ComponentConsequent[];
	parent: ElementInline;
	protected path: Path<IfStatement>;
	constructor(path: Path<IfStatement>, parent: ElementInline);
}
declare class ComponentFor extends ElementInline {
	public path: Path<For>;
	public context: StackFrame;

	constructor(path: Path<For>, context: StackFrame);
}
declare abstract class Attribute<T extends Expression = Expression> {
    type: "props" | "style";
    name: string | undefined;
    value: FlatValue | T | undefined;
    path?: Path<T> | undefined;
    overriden?: boolean;
    constructor(type: "props" | "style", name: string | undefined, value: FlatValue | T | undefined, path?: Path<T> | undefined);
}
declare class SpreadItem extends Attribute {
    insensitive?: boolean;
    constructor(type: "props" | "style", node: FlatValue | Expression | undefined, path?: Path<Expression>);
}
declare class Prop extends Attribute {
    synthetic?: boolean;
    constructor(name: string, node: FlatValue | Expression | undefined, path?: Path<Expression>);
}
declare class ExplicitStyle extends Attribute {
    priority: number;
    constructor(name: string, node: FlatValue | Expression | undefined, path?: Path<Expression>);
}
declare class StackFrame {
	program: any;
	styleRoot: any;
	current: any;
	currentElement?: ElementInline;
	stateSingleton: BabelState;
	options: {};
	constructor(state: BabelState);
	readonly parent: any;
	register(node: TraversableBody): any;
	push(node: AttributeBody): void;
	pop(): void;
	propertyMod(name: string): GeneralModifier;
	propertyMod(name: string, set: Function): void;
	hasOwnPropertyMod(name: string): boolean;
}
declare class ElementModifier extends AttributeBody {
	name: string;
	constructor(name: string, body: Path<Statement>, context: StackFrame);
	generate(): Syntax;
	declare(target: AttributeBody): void;
	into(accumulator: ModifierOutput): void;
}
declare class GeneralModifier {
	name: string;
	transform?: ModifyAction;
	constructor(name: string, transform?: ModifyAction);
}
declare class ModifyDelegate {
	name: string;
	target: AttributeBody;
	done?: true;
	priority?: number;
	arguments?: Array<any>;
	data: BunchOf<any>;
	constructor(name: string, value: Path<Expression>[], target: AttributeBody, transform?: ModifyAction);
	assign(data: any): void;
}
declare abstract class AssembleElement
	<From extends ElementInline = ElementInline> {
	abstract source: From;
	abstract Statement<T extends Statement>(item: Path<T> | T): void;
    abstract Content<T extends Expression = never>(item: Path<T> | T): void;
    abstract Child<T extends Expression = never>(item: ElementInline): void
    abstract Props(prop: Prop | SpreadItem, overridden?: true): void;
    abstract Style(style: ExplicitStyle | SpreadItem, overridden?: true): void;abstract Switch(item: ComponentIf): void;
	abstract Iterate(item: ComponentFor): void;
	
    willParse?(): void;
	didParse?(): void;
	
	/**
	 * @param overridden Prevent drop of named attributes where duplicates do exist.
	 */
	parse(overridden?: true): void;
}
declare const _default: (options: any) => {
	manipulateOptions: (options: any, parse: any) => void;
	visitor: {
		Program: BabelVisitor<Program>;
	};
};

declare type ParseError = (path: Path, ...args: (string | number)[]) => Error;
declare type Literal = string | number | boolean | null;
declare type ModifyAction = (this: ModifyDelegate, ...args: any[]) => ModifierOutput | undefined;
declare type Syntax = [Expression, Statement[]?];
declare type ElementItem = Attribute | ElementInline | Path<Expression | Statement>;
declare type ModTuple = [GeneralModifier, Path<Statement>];
declare type FlatValue = string | number | boolean | null;
declare type InnerContent = ElementInline | ComponentIf | ComponentFor | Path<Expression>;
declare type SequenceItem = Attr | InnerContent | Path<Statement>;
declare type Attr = Prop | ExplicitStyle | SpreadItem;


declare function PossibleExceptions
	<O extends BunchOf<string>>(register: O): 
	{ readonly [P in keyof O]: ParseError };
	
export default _default;

export {
	AssembleElement,
	DoExpressive,
	SequenceItem,
	SpreadItem,
	Prop,
	ExplicitStyle,
	ElementInline,
	Syntax,
	ComponentExpression,
	ComponentIf,
	ComponentConsequent,
	ComponentFor,
	StackFrame,
	PossibleExceptions,
	Path
}