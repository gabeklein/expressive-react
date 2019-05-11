import { NodePath as Path } from '@babel/traverse';
import { AssignmentExpression, expressionStatement, For } from '@babel/types';
import { StackFrame } from 'parse';
import { ParseErrors } from 'shared';

import { ElementInline } from './';

const Error = ParseErrors({
    AcceptsNoAssignments: "For block cannot accept Assignments",
    cantAssign: "Assignment of variable left of \"of\" must be Identifier or Destruture",
    notImplemented: "Only For-Of loop is currently implemented; complain to dev!"
})

export class ComponentFor extends ElementInline {
    constructor(
        public path: Path<For>, 
        public context: StackFrame){
            
        super(context);

        if(!path.isForOfStatement())
            throw Error.notImplemented(path)

        const body = path.get("body");
        const doBlock = this.handleContentBody(body);

        if(doBlock)
            body.replaceWith(
                expressionStatement(doBlock));
    }

    AssignmentExpression(path: Path<AssignmentExpression>){
        Error.AcceptsNoAssignments(path);
    }

    Prop(){
        void 0
    }
}