import inferReactComponent      from "babel-plugin-infer-react-class";
import transformExpressiveLoops from "babel-plugin-transform-expressive-loops";
import transformExpressiveReact from "babel-plugin-transform-expressive-react";

module.exports = options => {
    return {
        plugins: [
            [inferReactComponent, {
                activeOnMethodDo: true
            }],
            transformExpressiveLoops,
            [transformExpressiveReact, {
                styleMode: "next",
                applicationType: "next"
            }],
        ]
    }
}