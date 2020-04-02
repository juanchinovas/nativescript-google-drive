import "tns-core-modules/globals";

import { NativeObjectPool } from "nativescript-native-object-pool";

const context: Worker = self as any;

context.onmessage = (msg: MessageEvent) => {
    const {func, args} = msg.data;
    // Don't use eval if you don't really need it
    let fn = func && eval(`(${func})`);
    const fnArgs = getFuncArgsAsArray(args);

    // Execute function
    if (fn && fnArgs) {
        const valueReturned = fn.apply(null, fnArgs);
        if (valueReturned) /*iOS*/{
            onCompleted(valueReturned);
        }
    }
};

/**
 * Get all the function parameter's values and return it as array of object
 * @param {any} args
 */
function getFuncArgsAsArray(args: any): Array<any> {
    const argsArray = [];
    if (args) {
        for (const key in args) {
            if (args[key] === '+' || args[key] === '-') {
                argsArray.push(getNativeReference(key));
                if (args[key] === '+') {
                    NativeObjectPool.remove(key);
                }
                continue;
            }
            argsArray.push(args[key]);
        }
    }

    return argsArray;
}

/**
 * Look at args object shared with the native pool
 * @param {string} key
 */
function getNativeReference(key: string): any {
    const ref = NativeObjectPool.get(key);
    return ref;
}

function onCompleted(data: any) {
    (<any>global).postMessage(data);
}