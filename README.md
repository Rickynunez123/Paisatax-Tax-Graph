npm test -- tests/core/engine.test.ts


1. — initializeSession + propagateDirty + runComputationPass need to understand primary → spouse mirroring for repeatable nodes)

2. — Add getAll(prefix) to ComputeContext for dynamic multi-instance aggregation

3. — Add FormInstanceRegistry — the module that manages W-2 slots above the engine

4. — Build w2/nodes.ts with the slot-aware ID convention


Once the graph is build it is static, but sometimes the tax prep will keep addding forms. Such as multiple W2 so we need a form of differentiate between the spouse and the main tax payer, and make sure the engine reads from multiple forms of the same. Not only one. 


Topological sort 
* Allows you to create a sequence of nodes were all the dependencies are going to be first. 

So first we will build the graph, which is static, to add all the rules and the traversal. 

When you are done with a node you add it in reverse to a list. 


Depth First Search, then when you

A is a depndency for everyone 

So we start with A, then with D that has depndency of A, then H
So once is build, then we need to traverse according to the nodes 