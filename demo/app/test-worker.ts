import "tns-core-modules/globals";

const context: Worker = self as any;

context.onmessage = (msg) => {
    console.log("Thread.: ", java.lang.Thread.currentThread().getName());
    const aa = java.util.Collections.singletonList("root");
    console.log(msg);
    console.log(aa.toString());
}

