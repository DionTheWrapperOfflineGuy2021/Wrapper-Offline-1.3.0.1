HeapSnapshotWorker.AllocationProfile=class{constructor(profile,liveObjectStats){this._strings=profile.strings;this._liveObjectStats=liveObjectStats;this._nextNodeId=1;this._functionInfos=[];this._idToNode={};this._idToTopDownNode={};this._collapsedTopNodeIdToFunctionInfo={};this._traceTops=null;this._buildFunctionAllocationInfos(profile);this._traceTree=this._buildAllocationTree(profile,liveObjectStats);}
_buildFunctionAllocationInfos(profile){const strings=this._strings;const functionInfoFields=profile.snapshot.meta.trace_function_info_fields;const functionNameOffset=functionInfoFields.indexOf('name');const scriptNameOffset=functionInfoFields.indexOf('script_name');const scriptIdOffset=functionInfoFields.indexOf('script_id');const lineOffset=functionInfoFields.indexOf('line');const columnOffset=functionInfoFields.indexOf('column');const functionInfoFieldCount=functionInfoFields.length;const rawInfos=profile.trace_function_infos;const infoLength=rawInfos.length;const functionInfos=this._functionInfos=new Array(infoLength/functionInfoFieldCount);let index=0;for(let i=0;i<infoLength;i+=functionInfoFieldCount){functionInfos[index++]=new HeapSnapshotWorker.FunctionAllocationInfo(strings[rawInfos[i+functionNameOffset]],strings[rawInfos[i+scriptNameOffset]],rawInfos[i+scriptIdOffset],rawInfos[i+lineOffset],rawInfos[i+columnOffset]);}}
_buildAllocationTree(profile,liveObjectStats){const traceTreeRaw=profile.trace_tree;const functionInfos=this._functionInfos;const idToTopDownNode=this._idToTopDownNode;const traceNodeFields=profile.snapshot.meta.trace_node_fields;const nodeIdOffset=traceNodeFields.indexOf('id');const functionInfoIndexOffset=traceNodeFields.indexOf('function_info_index');const allocationCountOffset=traceNodeFields.indexOf('count');const allocationSizeOffset=traceNodeFields.indexOf('size');const childrenOffset=traceNodeFields.indexOf('children');const nodeFieldCount=traceNodeFields.length;function traverseNode(rawNodeArray,nodeOffset,parent){const functionInfo=functionInfos[rawNodeArray[nodeOffset+functionInfoIndexOffset]];const id=rawNodeArray[nodeOffset+nodeIdOffset];const stats=liveObjectStats[id];const liveCount=stats?stats.count:0;const liveSize=stats?stats.size:0;const result=new HeapSnapshotWorker.TopDownAllocationNode(id,functionInfo,rawNodeArray[nodeOffset+allocationCountOffset],rawNodeArray[nodeOffset+allocationSizeOffset],liveCount,liveSize,parent);idToTopDownNode[id]=result;functionInfo.addTraceTopNode(result);const rawChildren=rawNodeArray[nodeOffset+childrenOffset];for(let i=0;i<rawChildren.length;i+=nodeFieldCount){result.children.push(traverseNode(rawChildren,i,result));}
return result;}
return traverseNode(traceTreeRaw,0,null);}
serializeTraceTops(){if(this._traceTops){return this._traceTops;}
const result=this._traceTops=[];const functionInfos=this._functionInfos;for(let i=0;i<functionInfos.length;i++){const info=functionInfos[i];if(info.totalCount===0){continue;}
const nodeId=this._nextNodeId++;const isRoot=i===0;result.push(this._serializeNode(nodeId,info,info.totalCount,info.totalSize,info.totalLiveCount,info.totalLiveSize,!isRoot));this._collapsedTopNodeIdToFunctionInfo[nodeId]=info;}
result.sort(function(a,b){return b.size-a.size;});return result;}
serializeCallers(nodeId){let node=this._ensureBottomUpNode(nodeId);const nodesWithSingleCaller=[];while(node.callers().length===1){node=node.callers()[0];nodesWithSingleCaller.push(this._serializeCaller(node));}
const branchingCallers=[];const callers=node.callers();for(let i=0;i<callers.length;i++){branchingCallers.push(this._serializeCaller(callers[i]));}
return new HeapSnapshotModel.AllocationNodeCallers(nodesWithSingleCaller,branchingCallers);}
serializeAllocationStack(traceNodeId){let node=this._idToTopDownNode[traceNodeId];const result=[];while(node){const functionInfo=node.functionInfo;result.push(new HeapSnapshotModel.AllocationStackFrame(functionInfo.functionName,functionInfo.scriptName,functionInfo.scriptId,functionInfo.line,functionInfo.column));node=node.parent;}
return result;}
traceIds(allocationNodeId){return this._ensureBottomUpNode(allocationNodeId).traceTopIds;}
_ensureBottomUpNode(nodeId){let node=this._idToNode[nodeId];if(!node){const functionInfo=this._collapsedTopNodeIdToFunctionInfo[nodeId];node=functionInfo.bottomUpRoot();delete this._collapsedTopNodeIdToFunctionInfo[nodeId];this._idToNode[nodeId]=node;}
return node;}
_serializeCaller(node){const callerId=this._nextNodeId++;this._idToNode[callerId]=node;return this._serializeNode(callerId,node.functionInfo,node.allocationCount,node.allocationSize,node.liveCount,node.liveSize,node.hasCallers());}
_serializeNode(nodeId,functionInfo,count,size,liveCount,liveSize,hasChildren){return new HeapSnapshotModel.SerializedAllocationNode(nodeId,functionInfo.functionName,functionInfo.scriptName,functionInfo.scriptId,functionInfo.line,functionInfo.column,count,size,liveCount,liveSize,hasChildren);}};HeapSnapshotWorker.TopDownAllocationNode=class{constructor(id,functionInfo,count,size,liveCount,liveSize,parent){this.id=id;this.functionInfo=functionInfo;this.allocationCount=count;this.allocationSize=size;this.liveCount=liveCount;this.liveSize=liveSize;this.parent=parent;this.children=[];}};HeapSnapshotWorker.BottomUpAllocationNode=class{constructor(functionInfo){this.functionInfo=functionInfo;this.allocationCount=0;this.allocationSize=0;this.liveCount=0;this.liveSize=0;this.traceTopIds=[];this._callers=[];}
addCaller(traceNode){const functionInfo=traceNode.functionInfo;let result;for(let i=0;i<this._callers.length;i++){const caller=this._callers[i];if(caller.functionInfo===functionInfo){result=caller;break;}}
if(!result){result=new HeapSnapshotWorker.BottomUpAllocationNode(functionInfo);this._callers.push(result);}
return result;}
callers(){return this._callers;}
hasCallers(){return this._callers.length>0;}};HeapSnapshotWorker.FunctionAllocationInfo=class{constructor(functionName,scriptName,scriptId,line,column){this.functionName=functionName;this.scriptName=scriptName;this.scriptId=scriptId;this.line=line;this.column=column;this.totalCount=0;this.totalSize=0;this.totalLiveCount=0;this.totalLiveSize=0;this._traceTops=[];}
addTraceTopNode(node){if(node.allocationCount===0){return;}
this._traceTops.push(node);this.totalCount+=node.allocationCount;this.totalSize+=node.allocationSize;this.totalLiveCount+=node.liveCount;this.totalLiveSize+=node.liveSize;}
bottomUpRoot(){if(!this._traceTops.length){return null;}
if(!this._bottomUpTree){this._buildAllocationTraceTree();}
return this._bottomUpTree;}
_buildAllocationTraceTree(){this._bottomUpTree=new HeapSnapshotWorker.BottomUpAllocationNode(this);for(let i=0;i<this._traceTops.length;i++){let node=this._traceTops[i];let bottomUpNode=this._bottomUpTree;const count=node.allocationCount;const size=node.allocationSize;const liveCount=node.liveCount;const liveSize=node.liveSize;const traceId=node.id;while(true){bottomUpNode.allocationCount+=count;bottomUpNode.allocationSize+=size;bottomUpNode.liveCount+=liveCount;bottomUpNode.liveSize+=liveSize;bottomUpNode.traceTopIds.push(traceId);node=node.parent;if(node===null){break;}
bottomUpNode=bottomUpNode.addCaller(node);}}}};;HeapSnapshotWorker.HeapSnapshotItem=function(){};HeapSnapshotWorker.HeapSnapshotItem.prototype={itemIndex(){},serialize(){}};HeapSnapshotWorker.HeapSnapshotEdge=class{constructor(snapshot,edgeIndex){this._snapshot=snapshot;this._edges=snapshot.containmentEdges;this.edgeIndex=edgeIndex||0;}
clone(){return new HeapSnapshotWorker.HeapSnapshotEdge(this._snapshot,this.edgeIndex);}
hasStringName(){throw new Error('Not implemented');}
name(){throw new Error('Not implemented');}
node(){return this._snapshot.createNode(this.nodeIndex());}
nodeIndex(){return this._edges[this.edgeIndex+this._snapshot._edgeToNodeOffset];}
toString(){return'HeapSnapshotEdge: '+this.name();}
type(){return this._snapshot._edgeTypes[this.rawType()];}
itemIndex(){return this.edgeIndex;}
serialize(){return new HeapSnapshotModel.Edge(this.name(),this.node().serialize(),this.type(),this.edgeIndex);}
rawType(){return this._edges[this.edgeIndex+this._snapshot._edgeTypeOffset];}};HeapSnapshotWorker.HeapSnapshotItemIterator=function(){};HeapSnapshotWorker.HeapSnapshotItemIterator.prototype={hasNext(){},item(){},next(){}};HeapSnapshotWorker.HeapSnapshotItemIndexProvider=function(){};HeapSnapshotWorker.HeapSnapshotItemIndexProvider.prototype={itemForIndex(newIndex){},};HeapSnapshotWorker.HeapSnapshotNodeIndexProvider=class{constructor(snapshot){this._node=snapshot.createNode();}
itemForIndex(index){this._node.nodeIndex=index;return this._node;}};HeapSnapshotWorker.HeapSnapshotEdgeIndexProvider=class{constructor(snapshot){this._edge=snapshot.createEdge(0);}
itemForIndex(index){this._edge.edgeIndex=index;return this._edge;}};HeapSnapshotWorker.HeapSnapshotRetainerEdgeIndexProvider=class{constructor(snapshot){this._retainerEdge=snapshot.createRetainingEdge(0);}
itemForIndex(index){this._retainerEdge.setRetainerIndex(index);return this._retainerEdge;}};HeapSnapshotWorker.HeapSnapshotEdgeIterator=class{constructor(node){this._sourceNode=node;this.edge=node._snapshot.createEdge(node.edgeIndexesStart());}
hasNext(){return this.edge.edgeIndex<this._sourceNode.edgeIndexesEnd();}
item(){return this.edge;}
next(){this.edge.edgeIndex+=this.edge._snapshot._edgeFieldsCount;}};HeapSnapshotWorker.HeapSnapshotRetainerEdge=class{constructor(snapshot,retainerIndex){this._snapshot=snapshot;this.setRetainerIndex(retainerIndex);}
clone(){return new HeapSnapshotWorker.HeapSnapshotRetainerEdge(this._snapshot,this.retainerIndex());}
hasStringName(){return this._edge().hasStringName();}
name(){return this._edge().name();}
node(){return this._node();}
nodeIndex(){return this._retainingNodeIndex;}
retainerIndex(){return this._retainerIndex;}
setRetainerIndex(retainerIndex){if(retainerIndex===this._retainerIndex){return;}
this._retainerIndex=retainerIndex;this._globalEdgeIndex=this._snapshot._retainingEdges[retainerIndex];this._retainingNodeIndex=this._snapshot._retainingNodes[retainerIndex];this._edgeInstance=null;this._nodeInstance=null;}
set edgeIndex(edgeIndex){this.setRetainerIndex(edgeIndex);}
_node(){if(!this._nodeInstance){this._nodeInstance=this._snapshot.createNode(this._retainingNodeIndex);}
return this._nodeInstance;}
_edge(){if(!this._edgeInstance){this._edgeInstance=this._snapshot.createEdge(this._globalEdgeIndex);}
return this._edgeInstance;}
toString(){return this._edge().toString();}
itemIndex(){return this._retainerIndex;}
serialize(){return new HeapSnapshotModel.Edge(this.name(),this.node().serialize(),this.type(),this._globalEdgeIndex);}
type(){return this._edge().type();}};HeapSnapshotWorker.HeapSnapshotRetainerEdgeIterator=class{constructor(retainedNode){const snapshot=retainedNode._snapshot;const retainedNodeOrdinal=retainedNode.ordinal();const retainerIndex=snapshot._firstRetainerIndex[retainedNodeOrdinal];this._retainersEnd=snapshot._firstRetainerIndex[retainedNodeOrdinal+1];this.retainer=snapshot.createRetainingEdge(retainerIndex);}
hasNext(){return this.retainer.retainerIndex()<this._retainersEnd;}
item(){return this.retainer;}
next(){this.retainer.setRetainerIndex(this.retainer.retainerIndex()+1);}};HeapSnapshotWorker.HeapSnapshotNode=class{constructor(snapshot,nodeIndex){this._snapshot=snapshot;this.nodeIndex=nodeIndex||0;}
distance(){return this._snapshot._nodeDistances[this.nodeIndex/this._snapshot._nodeFieldCount];}
className(){throw new Error('Not implemented');}
classIndex(){throw new Error('Not implemented');}
dominatorIndex(){const nodeFieldCount=this._snapshot._nodeFieldCount;return this._snapshot._dominatorsTree[this.nodeIndex/this._snapshot._nodeFieldCount]*nodeFieldCount;}
edges(){return new HeapSnapshotWorker.HeapSnapshotEdgeIterator(this);}
edgesCount(){return(this.edgeIndexesEnd()-this.edgeIndexesStart())/this._snapshot._edgeFieldsCount;}
id(){throw new Error('Not implemented');}
isRoot(){return this.nodeIndex===this._snapshot._rootNodeIndex;}
name(){return this._snapshot.strings[this._name()];}
retainedSize(){return this._snapshot._retainedSizes[this.ordinal()];}
retainers(){return new HeapSnapshotWorker.HeapSnapshotRetainerEdgeIterator(this);}
retainersCount(){const snapshot=this._snapshot;const ordinal=this.ordinal();return snapshot._firstRetainerIndex[ordinal+1]-snapshot._firstRetainerIndex[ordinal];}
selfSize(){const snapshot=this._snapshot;return snapshot.nodes[this.nodeIndex+snapshot._nodeSelfSizeOffset];}
type(){return this._snapshot._nodeTypes[this.rawType()];}
traceNodeId(){const snapshot=this._snapshot;return snapshot.nodes[this.nodeIndex+snapshot._nodeTraceNodeIdOffset];}
itemIndex(){return this.nodeIndex;}
serialize(){return new HeapSnapshotModel.Node(this.id(),this.name(),this.distance(),this.nodeIndex,this.retainedSize(),this.selfSize(),this.type());}
_name(){const snapshot=this._snapshot;return snapshot.nodes[this.nodeIndex+snapshot._nodeNameOffset];}
edgeIndexesStart(){return this._snapshot._firstEdgeIndexes[this.ordinal()];}
edgeIndexesEnd(){return this._snapshot._firstEdgeIndexes[this.ordinal()+1];}
ordinal(){return this.nodeIndex/this._snapshot._nodeFieldCount;}
_nextNodeIndex(){return this.nodeIndex+this._snapshot._nodeFieldCount;}
rawType(){const snapshot=this._snapshot;return snapshot.nodes[this.nodeIndex+snapshot._nodeTypeOffset];}};HeapSnapshotWorker.HeapSnapshotNodeIterator=class{constructor(node){this.node=node;this._nodesLength=node._snapshot.nodes.length;}
hasNext(){return this.node.nodeIndex<this._nodesLength;}
item(){return this.node;}
next(){this.node.nodeIndex=this.node._nextNodeIndex();}};HeapSnapshotWorker.HeapSnapshotIndexRangeIterator=class{constructor(itemProvider,indexes){this._itemProvider=itemProvider;this._indexes=indexes;this._position=0;}
hasNext(){return this._position<this._indexes.length;}
item(){const index=this._indexes[this._position];return this._itemProvider.itemForIndex(index);}
next(){++this._position;}};HeapSnapshotWorker.HeapSnapshotFilteredIterator=class{constructor(iterator,filter){this._iterator=iterator;this._filter=filter;this._skipFilteredItems();}
hasNext(){return this._iterator.hasNext();}
item(){return this._iterator.item();}
next(){this._iterator.next();this._skipFilteredItems();}
_skipFilteredItems(){while(this._iterator.hasNext()&&!this._filter(this._iterator.item())){this._iterator.next();}}};HeapSnapshotWorker.HeapSnapshotProgress=class{constructor(dispatcher){this._dispatcher=dispatcher;}
updateStatus(status){this._sendUpdateEvent(self.serializeUIString(status));}
updateProgress(title,value,total){const percentValue=((total?(value/total):0)*100).toFixed(0);this._sendUpdateEvent(self.serializeUIString(title,[percentValue]));}
reportProblem(error){if(this._dispatcher){this._dispatcher.sendEvent(HeapSnapshotModel.HeapSnapshotProgressEvent.BrokenSnapshot,error);}}
_sendUpdateEvent(serializedText){if(this._dispatcher){this._dispatcher.sendEvent(HeapSnapshotModel.HeapSnapshotProgressEvent.Update,serializedText);}}};HeapSnapshotWorker.HeapSnapshotProblemReport=class{constructor(title){this._errors=[title];}
addError(error){if(this._errors.length>100){return;}
this._errors.push(error);}
toString(){return this._errors.join('\n  ');}};HeapSnapshotWorker.HeapSnapshot=class{constructor(profile,progress){this.nodes=profile.nodes;this.containmentEdges=profile.edges;this._metaNode=profile.snapshot.meta;this._rawSamples=profile.samples;this._samples=null;this.strings=profile.strings;this._locations=profile.locations;this._progress=progress;this._noDistance=-5;this._rootNodeIndex=0;if(profile.snapshot.root_index){this._rootNodeIndex=profile.snapshot.root_index;}
this._snapshotDiffs={};this._aggregatesForDiff=null;this._aggregates={};this._aggregatesSortedFlags={};this._profile=profile;}
initialize(){const meta=this._metaNode;this._nodeTypeOffset=meta.node_fields.indexOf('type');this._nodeNameOffset=meta.node_fields.indexOf('name');this._nodeIdOffset=meta.node_fields.indexOf('id');this._nodeSelfSizeOffset=meta.node_fields.indexOf('self_size');this._nodeEdgeCountOffset=meta.node_fields.indexOf('edge_count');this._nodeTraceNodeIdOffset=meta.node_fields.indexOf('trace_node_id');this._nodeFieldCount=meta.node_fields.length;this._nodeTypes=meta.node_types[this._nodeTypeOffset];this._nodeArrayType=this._nodeTypes.indexOf('array');this._nodeHiddenType=this._nodeTypes.indexOf('hidden');this._nodeObjectType=this._nodeTypes.indexOf('object');this._nodeNativeType=this._nodeTypes.indexOf('native');this._nodeConsStringType=this._nodeTypes.indexOf('concatenated string');this._nodeSlicedStringType=this._nodeTypes.indexOf('sliced string');this._nodeCodeType=this._nodeTypes.indexOf('code');this._nodeSyntheticType=this._nodeTypes.indexOf('synthetic');this._edgeFieldsCount=meta.edge_fields.length;this._edgeTypeOffset=meta.edge_fields.indexOf('type');this._edgeNameOffset=meta.edge_fields.indexOf('name_or_index');this._edgeToNodeOffset=meta.edge_fields.indexOf('to_node');this._edgeTypes=meta.edge_types[this._edgeTypeOffset];this._edgeTypes.push('invisible');this._edgeElementType=this._edgeTypes.indexOf('element');this._edgeHiddenType=this._edgeTypes.indexOf('hidden');this._edgeInternalType=this._edgeTypes.indexOf('internal');this._edgeShortcutType=this._edgeTypes.indexOf('shortcut');this._edgeWeakType=this._edgeTypes.indexOf('weak');this._edgeInvisibleType=this._edgeTypes.indexOf('invisible');const location_fields=meta.location_fields||[];this._locationIndexOffset=location_fields.indexOf('object_index');this._locationScriptIdOffset=location_fields.indexOf('script_id');this._locationLineOffset=location_fields.indexOf('line');this._locationColumnOffset=location_fields.indexOf('column');this._locationFieldCount=location_fields.length;this.nodeCount=this.nodes.length/this._nodeFieldCount;this._edgeCount=this.containmentEdges.length/this._edgeFieldsCount;this._retainedSizes=new Float64Array(this.nodeCount);this._firstEdgeIndexes=new Uint32Array(this.nodeCount+1);this._retainingNodes=new Uint32Array(this._edgeCount);this._retainingEdges=new Uint32Array(this._edgeCount);this._firstRetainerIndex=new Uint32Array(this.nodeCount+1);this._nodeDistances=new Int32Array(this.nodeCount);this._firstDominatedNodeIndex=new Uint32Array(this.nodeCount+1);this._dominatedNodes=new Uint32Array(this.nodeCount-1);this._progress.updateStatus(ls`Building edge indexes\u2026`);this._buildEdgeIndexes();this._progress.updateStatus(ls`Building retainers\u2026`);this._buildRetainers();this._progress.updateStatus(ls`Calculating node flags\u2026`);this.calculateFlags();this._progress.updateStatus(ls`Calculating distances\u2026`);this.calculateDistances();this._progress.updateStatus(ls`Building postorder index\u2026`);const result=this._buildPostOrderIndex();this._progress.updateStatus(ls`Building dominator tree\u2026`);this._dominatorsTree=this._buildDominatorTree(result.postOrderIndex2NodeOrdinal,result.nodeOrdinal2PostOrderIndex);this._progress.updateStatus(ls`Calculating retained sizes\u2026`);this._calculateRetainedSizes(result.postOrderIndex2NodeOrdinal);this._progress.updateStatus(ls`Building dominated nodes\u2026`);this._buildDominatedNodes();this._progress.updateStatus(ls`Calculating statistics\u2026`);this.calculateStatistics();this._progress.updateStatus(ls`Calculating samples\u2026`);this._buildSamples();this._progress.updateStatus(ls`Building locations\u2026`);this._buildLocationMap();this._progress.updateStatus(ls`Finished processing.`);if(this._profile.snapshot.trace_function_count){this._progress.updateStatus(ls`Building allocation statistics\u2026`);const nodes=this.nodes;const nodesLength=nodes.length;const nodeFieldCount=this._nodeFieldCount;const node=this.rootNode();const liveObjects={};for(let nodeIndex=0;nodeIndex<nodesLength;nodeIndex+=nodeFieldCount){node.nodeIndex=nodeIndex;const traceNodeId=node.traceNodeId();let stats=liveObjects[traceNodeId];if(!stats){liveObjects[traceNodeId]=stats={count:0,size:0,ids:[]};}
stats.count++;stats.size+=node.selfSize();stats.ids.push(node.id());}
this._allocationProfile=new HeapSnapshotWorker.AllocationProfile(this._profile,liveObjects);this._progress.updateStatus(ls`Done`);}}
_buildEdgeIndexes(){const nodes=this.nodes;const nodeCount=this.nodeCount;const firstEdgeIndexes=this._firstEdgeIndexes;const nodeFieldCount=this._nodeFieldCount;const edgeFieldsCount=this._edgeFieldsCount;const nodeEdgeCountOffset=this._nodeEdgeCountOffset;firstEdgeIndexes[nodeCount]=this.containmentEdges.length;for(let nodeOrdinal=0,edgeIndex=0;nodeOrdinal<nodeCount;++nodeOrdinal){firstEdgeIndexes[nodeOrdinal]=edgeIndex;edgeIndex+=nodes[nodeOrdinal*nodeFieldCount+nodeEdgeCountOffset]*edgeFieldsCount;}}
_buildRetainers(){const retainingNodes=this._retainingNodes;const retainingEdges=this._retainingEdges;const firstRetainerIndex=this._firstRetainerIndex;const containmentEdges=this.containmentEdges;const edgeFieldsCount=this._edgeFieldsCount;const nodeFieldCount=this._nodeFieldCount;const edgeToNodeOffset=this._edgeToNodeOffset;const firstEdgeIndexes=this._firstEdgeIndexes;const nodeCount=this.nodeCount;for(let toNodeFieldIndex=edgeToNodeOffset,l=containmentEdges.length;toNodeFieldIndex<l;toNodeFieldIndex+=edgeFieldsCount){const toNodeIndex=containmentEdges[toNodeFieldIndex];if(toNodeIndex%nodeFieldCount){throw new Error('Invalid toNodeIndex '+toNodeIndex);}
++firstRetainerIndex[toNodeIndex/nodeFieldCount];}
for(let i=0,firstUnusedRetainerSlot=0;i<nodeCount;i++){const retainersCount=firstRetainerIndex[i];firstRetainerIndex[i]=firstUnusedRetainerSlot;retainingNodes[firstUnusedRetainerSlot]=retainersCount;firstUnusedRetainerSlot+=retainersCount;}
firstRetainerIndex[nodeCount]=retainingNodes.length;let nextNodeFirstEdgeIndex=firstEdgeIndexes[0];for(let srcNodeOrdinal=0;srcNodeOrdinal<nodeCount;++srcNodeOrdinal){const firstEdgeIndex=nextNodeFirstEdgeIndex;nextNodeFirstEdgeIndex=firstEdgeIndexes[srcNodeOrdinal+1];const srcNodeIndex=srcNodeOrdinal*nodeFieldCount;for(let edgeIndex=firstEdgeIndex;edgeIndex<nextNodeFirstEdgeIndex;edgeIndex+=edgeFieldsCount){const toNodeIndex=containmentEdges[edgeIndex+edgeToNodeOffset];if(toNodeIndex%nodeFieldCount){throw new Error('Invalid toNodeIndex '+toNodeIndex);}
const firstRetainerSlotIndex=firstRetainerIndex[toNodeIndex/nodeFieldCount];const nextUnusedRetainerSlotIndex=firstRetainerSlotIndex+(--retainingNodes[firstRetainerSlotIndex]);retainingNodes[nextUnusedRetainerSlotIndex]=srcNodeIndex;retainingEdges[nextUnusedRetainerSlotIndex]=edgeIndex;}}}
createNode(nodeIndex){throw new Error('Not implemented');}
createEdge(edgeIndex){throw new Error('Not implemented');}
createRetainingEdge(retainerIndex){throw new Error('Not implemented');}
_allNodes(){return new HeapSnapshotWorker.HeapSnapshotNodeIterator(this.rootNode());}
rootNode(){return this.createNode(this._rootNodeIndex);}
get rootNodeIndex(){return this._rootNodeIndex;}
get totalSize(){return this.rootNode().retainedSize();}
_getDominatedIndex(nodeIndex){if(nodeIndex%this._nodeFieldCount){throw new Error('Invalid nodeIndex: '+nodeIndex);}
return this._firstDominatedNodeIndex[nodeIndex/this._nodeFieldCount];}
_createFilter(nodeFilter){const minNodeId=nodeFilter.minNodeId;const maxNodeId=nodeFilter.maxNodeId;const allocationNodeId=nodeFilter.allocationNodeId;let filter;if(typeof allocationNodeId==='number'){filter=this._createAllocationStackFilter(allocationNodeId);filter.key='AllocationNodeId: '+allocationNodeId;}else if(typeof minNodeId==='number'&&typeof maxNodeId==='number'){filter=this._createNodeIdFilter(minNodeId,maxNodeId);filter.key='NodeIdRange: '+minNodeId+'..'+maxNodeId;}
return filter;}
search(searchConfig,nodeFilter){const query=searchConfig.query;function filterString(matchedStringIndexes,string,index){if(string.indexOf(query)!==-1){matchedStringIndexes.add(index);}
return matchedStringIndexes;}
const regexp=searchConfig.isRegex?new RegExp(query):createPlainTextSearchRegex(query,'i');function filterRegexp(matchedStringIndexes,string,index){if(regexp.test(string)){matchedStringIndexes.add(index);}
return matchedStringIndexes;}
const stringFilter=(searchConfig.isRegex||!searchConfig.caseSensitive)?filterRegexp:filterString;const stringIndexes=this.strings.reduce(stringFilter,new Set());if(!stringIndexes.size){return[];}
const filter=this._createFilter(nodeFilter);const nodeIds=[];const nodesLength=this.nodes.length;const nodes=this.nodes;const nodeNameOffset=this._nodeNameOffset;const nodeIdOffset=this._nodeIdOffset;const nodeFieldCount=this._nodeFieldCount;const node=this.rootNode();for(let nodeIndex=0;nodeIndex<nodesLength;nodeIndex+=nodeFieldCount){node.nodeIndex=nodeIndex;if(filter&&!filter(node)){continue;}
if(stringIndexes.has(nodes[nodeIndex+nodeNameOffset])){nodeIds.push(nodes[nodeIndex+nodeIdOffset]);}}
return nodeIds;}
aggregatesWithFilter(nodeFilter){const filter=this._createFilter(nodeFilter);const key=filter?filter.key:'allObjects';return this.aggregates(false,key,filter);}
_createNodeIdFilter(minNodeId,maxNodeId){function nodeIdFilter(node){const id=node.id();return id>minNodeId&&id<=maxNodeId;}
return nodeIdFilter;}
_createAllocationStackFilter(bottomUpAllocationNodeId){const traceIds=this._allocationProfile.traceIds(bottomUpAllocationNodeId);if(!traceIds.length){return undefined;}
const set={};for(let i=0;i<traceIds.length;i++){set[traceIds[i]]=true;}
function traceIdFilter(node){return!!set[node.traceNodeId()];}
return traceIdFilter;}
aggregates(sortedIndexes,key,filter){let aggregatesByClassName=key&&this._aggregates[key];if(!aggregatesByClassName){const aggregates=this._buildAggregates(filter);this._calculateClassesRetainedSize(aggregates.aggregatesByClassIndex,filter);aggregatesByClassName=aggregates.aggregatesByClassName;if(key){this._aggregates[key]=aggregatesByClassName;}}
if(sortedIndexes&&(!key||!this._aggregatesSortedFlags[key])){this._sortAggregateIndexes(aggregatesByClassName);if(key){this._aggregatesSortedFlags[key]=sortedIndexes;}}
return aggregatesByClassName;}
allocationTracesTops(){return this._allocationProfile.serializeTraceTops();}
allocationNodeCallers(nodeId){return this._allocationProfile.serializeCallers(nodeId);}
allocationStack(nodeIndex){const node=this.createNode(nodeIndex);const allocationNodeId=node.traceNodeId();if(!allocationNodeId){return null;}
return this._allocationProfile.serializeAllocationStack(allocationNodeId);}
aggregatesForDiff(){if(this._aggregatesForDiff){return this._aggregatesForDiff;}
const aggregatesByClassName=this.aggregates(true,'allObjects');this._aggregatesForDiff={};const node=this.createNode();for(const className in aggregatesByClassName){const aggregate=aggregatesByClassName[className];const indexes=aggregate.idxs;const ids=new Array(indexes.length);const selfSizes=new Array(indexes.length);for(let i=0;i<indexes.length;i++){node.nodeIndex=indexes[i];ids[i]=node.id();selfSizes[i]=node.selfSize();}
this._aggregatesForDiff[className]={indexes:indexes,ids:ids,selfSizes:selfSizes};}
return this._aggregatesForDiff;}
isUserRoot(node){return true;}
calculateDistances(filter){const nodeCount=this.nodeCount;const distances=this._nodeDistances;const noDistance=this._noDistance;for(let i=0;i<nodeCount;++i){distances[i]=noDistance;}
const nodesToVisit=new Uint32Array(this.nodeCount);let nodesToVisitLength=0;for(let iter=this.rootNode().edges();iter.hasNext();iter.next()){const node=iter.edge.node();if(this.isUserRoot(node)){distances[node.ordinal()]=1;nodesToVisit[nodesToVisitLength++]=node.nodeIndex;}}
this._bfs(nodesToVisit,nodesToVisitLength,distances,filter);distances[this.rootNode().ordinal()]=nodesToVisitLength>0?HeapSnapshotModel.baseSystemDistance:0;nodesToVisit[0]=this.rootNode().nodeIndex;nodesToVisitLength=1;this._bfs(nodesToVisit,nodesToVisitLength,distances,filter);}
_bfs(nodesToVisit,nodesToVisitLength,distances,filter){const edgeFieldsCount=this._edgeFieldsCount;const nodeFieldCount=this._nodeFieldCount;const containmentEdges=this.containmentEdges;const firstEdgeIndexes=this._firstEdgeIndexes;const edgeToNodeOffset=this._edgeToNodeOffset;const edgeTypeOffset=this._edgeTypeOffset;const nodeCount=this.nodeCount;const edgeWeakType=this._edgeWeakType;const noDistance=this._noDistance;let index=0;const edge=this.createEdge(0);const node=this.createNode(0);while(index<nodesToVisitLength){const nodeIndex=nodesToVisit[index++];const nodeOrdinal=nodeIndex/nodeFieldCount;const distance=distances[nodeOrdinal]+1;const firstEdgeIndex=firstEdgeIndexes[nodeOrdinal];const edgesEnd=firstEdgeIndexes[nodeOrdinal+1];node.nodeIndex=nodeIndex;for(let edgeIndex=firstEdgeIndex;edgeIndex<edgesEnd;edgeIndex+=edgeFieldsCount){const edgeType=containmentEdges[edgeIndex+edgeTypeOffset];if(edgeType===edgeWeakType){continue;}
const childNodeIndex=containmentEdges[edgeIndex+edgeToNodeOffset];const childNodeOrdinal=childNodeIndex/nodeFieldCount;if(distances[childNodeOrdinal]!==noDistance){continue;}
edge.edgeIndex=edgeIndex;if(filter&&!filter(node,edge)){continue;}
distances[childNodeOrdinal]=distance;nodesToVisit[nodesToVisitLength++]=childNodeIndex;}}
if(nodesToVisitLength>nodeCount){throw new Error('BFS failed. Nodes to visit ('+nodesToVisitLength+') is more than nodes count ('+nodeCount+')');}}
_buildAggregates(filter){const aggregates={};const aggregatesByClassName={};const classIndexes=[];const nodes=this.nodes;const nodesLength=nodes.length;const nodeNativeType=this._nodeNativeType;const nodeFieldCount=this._nodeFieldCount;const selfSizeOffset=this._nodeSelfSizeOffset;const nodeTypeOffset=this._nodeTypeOffset;const node=this.rootNode();const nodeDistances=this._nodeDistances;for(let nodeIndex=0;nodeIndex<nodesLength;nodeIndex+=nodeFieldCount){node.nodeIndex=nodeIndex;if(filter&&!filter(node)){continue;}
const selfSize=nodes[nodeIndex+selfSizeOffset];if(!selfSize&&nodes[nodeIndex+nodeTypeOffset]!==nodeNativeType){continue;}
const classIndex=node.classIndex();const nodeOrdinal=nodeIndex/nodeFieldCount;const distance=nodeDistances[nodeOrdinal];if(!(classIndex in aggregates)){const nodeType=node.type();const nameMatters=nodeType==='object'||nodeType==='native';const value={count:1,distance:distance,self:selfSize,maxRet:0,type:nodeType,name:nameMatters?node.name():null,idxs:[nodeIndex]};aggregates[classIndex]=value;classIndexes.push(classIndex);aggregatesByClassName[node.className()]=value;}else{const clss=aggregates[classIndex];clss.distance=Math.min(clss.distance,distance);++clss.count;clss.self+=selfSize;clss.idxs.push(nodeIndex);}}
for(let i=0,l=classIndexes.length;i<l;++i){const classIndex=classIndexes[i];aggregates[classIndex].idxs=aggregates[classIndex].idxs.slice();}
return{aggregatesByClassName:aggregatesByClassName,aggregatesByClassIndex:aggregates};}
_calculateClassesRetainedSize(aggregates,filter){const rootNodeIndex=this._rootNodeIndex;const node=this.createNode(rootNodeIndex);const list=[rootNodeIndex];const sizes=[-1];const classes=[];const seenClassNameIndexes={};const nodeFieldCount=this._nodeFieldCount;const nodeTypeOffset=this._nodeTypeOffset;const nodeNativeType=this._nodeNativeType;const dominatedNodes=this._dominatedNodes;const nodes=this.nodes;const firstDominatedNodeIndex=this._firstDominatedNodeIndex;while(list.length){const nodeIndex=list.pop();node.nodeIndex=nodeIndex;let classIndex=node.classIndex();const seen=!!seenClassNameIndexes[classIndex];const nodeOrdinal=nodeIndex/nodeFieldCount;const dominatedIndexFrom=firstDominatedNodeIndex[nodeOrdinal];const dominatedIndexTo=firstDominatedNodeIndex[nodeOrdinal+1];if(!seen&&(!filter||filter(node))&&(node.selfSize()||nodes[nodeIndex+nodeTypeOffset]===nodeNativeType)){aggregates[classIndex].maxRet+=node.retainedSize();if(dominatedIndexFrom!==dominatedIndexTo){seenClassNameIndexes[classIndex]=true;sizes.push(list.length);classes.push(classIndex);}}
for(let i=dominatedIndexFrom;i<dominatedIndexTo;i++){list.push(dominatedNodes[i]);}
const l=list.length;while(sizes[sizes.length-1]===l){sizes.pop();classIndex=classes.pop();seenClassNameIndexes[classIndex]=false;}}}
_sortAggregateIndexes(aggregates){const nodeA=this.createNode();const nodeB=this.createNode();for(const clss in aggregates){aggregates[clss].idxs.sort((idxA,idxB)=>{nodeA.nodeIndex=idxA;nodeB.nodeIndex=idxB;return nodeA.id()<nodeB.id()?-1:1;});}}
_isEssentialEdge(nodeIndex,edgeType){return edgeType!==this._edgeWeakType&&(edgeType!==this._edgeShortcutType||nodeIndex===this._rootNodeIndex);}
_buildPostOrderIndex(){const nodeFieldCount=this._nodeFieldCount;const nodeCount=this.nodeCount;const rootNodeOrdinal=this._rootNodeIndex/nodeFieldCount;const edgeFieldsCount=this._edgeFieldsCount;const edgeTypeOffset=this._edgeTypeOffset;const edgeToNodeOffset=this._edgeToNodeOffset;const firstEdgeIndexes=this._firstEdgeIndexes;const containmentEdges=this.containmentEdges;const mapAndFlag=this.userObjectsMapAndFlag();const flags=mapAndFlag?mapAndFlag.map:null;const flag=mapAndFlag?mapAndFlag.flag:0;const stackNodes=new Uint32Array(nodeCount);const stackCurrentEdge=new Uint32Array(nodeCount);const postOrderIndex2NodeOrdinal=new Uint32Array(nodeCount);const nodeOrdinal2PostOrderIndex=new Uint32Array(nodeCount);const visited=new Uint8Array(nodeCount);let postOrderIndex=0;let stackTop=0;stackNodes[0]=rootNodeOrdinal;stackCurrentEdge[0]=firstEdgeIndexes[rootNodeOrdinal];visited[rootNodeOrdinal]=1;let iteration=0;while(true){++iteration;while(stackTop>=0){const nodeOrdinal=stackNodes[stackTop];const edgeIndex=stackCurrentEdge[stackTop];const edgesEnd=firstEdgeIndexes[nodeOrdinal+1];if(edgeIndex<edgesEnd){stackCurrentEdge[stackTop]+=edgeFieldsCount;const edgeType=containmentEdges[edgeIndex+edgeTypeOffset];if(!this._isEssentialEdge(nodeOrdinal*nodeFieldCount,edgeType)){continue;}
const childNodeIndex=containmentEdges[edgeIndex+edgeToNodeOffset];const childNodeOrdinal=childNodeIndex/nodeFieldCount;if(visited[childNodeOrdinal]){continue;}
const nodeFlag=!flags||(flags[nodeOrdinal]&flag);const childNodeFlag=!flags||(flags[childNodeOrdinal]&flag);if(nodeOrdinal!==rootNodeOrdinal&&childNodeFlag&&!nodeFlag){continue;}
++stackTop;stackNodes[stackTop]=childNodeOrdinal;stackCurrentEdge[stackTop]=firstEdgeIndexes[childNodeOrdinal];visited[childNodeOrdinal]=1;}else{nodeOrdinal2PostOrderIndex[nodeOrdinal]=postOrderIndex;postOrderIndex2NodeOrdinal[postOrderIndex++]=nodeOrdinal;--stackTop;}}
if(postOrderIndex===nodeCount||iteration>1){break;}
const errors=new HeapSnapshotWorker.HeapSnapshotProblemReport(`Heap snapshot: ${
                            nodeCount - postOrderIndex
                          } nodes are unreachable from the root. Following nodes have only weak retainers:`);const dumpNode=this.rootNode();--postOrderIndex;stackTop=0;stackNodes[0]=rootNodeOrdinal;stackCurrentEdge[0]=firstEdgeIndexes[rootNodeOrdinal+1];for(let i=0;i<nodeCount;++i){if(visited[i]||!this._hasOnlyWeakRetainers(i)){continue;}
stackNodes[++stackTop]=i;stackCurrentEdge[stackTop]=firstEdgeIndexes[i];visited[i]=1;dumpNode.nodeIndex=i*nodeFieldCount;const retainers=[];for(let it=dumpNode.retainers();it.hasNext();it.next()){retainers.push(`${it.item().node().name()}@${it.item().node().id()}.${it.item().name()}`);}
errors.addError(`${dumpNode.name()} @${dumpNode.id()}  weak retainers: ${retainers.join(', ')}`);}
console.warn(errors.toString());}
if(postOrderIndex!==nodeCount){const errors=new HeapSnapshotWorker.HeapSnapshotProblemReport('Still found '+(nodeCount-postOrderIndex)+' unreachable nodes in heap snapshot:');const dumpNode=this.rootNode();--postOrderIndex;for(let i=0;i<nodeCount;++i){if(visited[i]){continue;}
dumpNode.nodeIndex=i*nodeFieldCount;errors.addError(dumpNode.name()+' @'+dumpNode.id());nodeOrdinal2PostOrderIndex[i]=postOrderIndex;postOrderIndex2NodeOrdinal[postOrderIndex++]=i;}
nodeOrdinal2PostOrderIndex[rootNodeOrdinal]=postOrderIndex;postOrderIndex2NodeOrdinal[postOrderIndex++]=rootNodeOrdinal;console.warn(errors.toString());}
return{postOrderIndex2NodeOrdinal:postOrderIndex2NodeOrdinal,nodeOrdinal2PostOrderIndex:nodeOrdinal2PostOrderIndex};}
_hasOnlyWeakRetainers(nodeOrdinal){const edgeTypeOffset=this._edgeTypeOffset;const edgeWeakType=this._edgeWeakType;const edgeShortcutType=this._edgeShortcutType;const containmentEdges=this.containmentEdges;const retainingEdges=this._retainingEdges;const beginRetainerIndex=this._firstRetainerIndex[nodeOrdinal];const endRetainerIndex=this._firstRetainerIndex[nodeOrdinal+1];for(let retainerIndex=beginRetainerIndex;retainerIndex<endRetainerIndex;++retainerIndex){const retainerEdgeIndex=retainingEdges[retainerIndex];const retainerEdgeType=containmentEdges[retainerEdgeIndex+edgeTypeOffset];if(retainerEdgeType!==edgeWeakType&&retainerEdgeType!==edgeShortcutType){return false;}}
return true;}
_buildDominatorTree(postOrderIndex2NodeOrdinal,nodeOrdinal2PostOrderIndex){const nodeFieldCount=this._nodeFieldCount;const firstRetainerIndex=this._firstRetainerIndex;const retainingNodes=this._retainingNodes;const retainingEdges=this._retainingEdges;const edgeFieldsCount=this._edgeFieldsCount;const edgeTypeOffset=this._edgeTypeOffset;const edgeToNodeOffset=this._edgeToNodeOffset;const firstEdgeIndexes=this._firstEdgeIndexes;const containmentEdges=this.containmentEdges;const rootNodeIndex=this._rootNodeIndex;const mapAndFlag=this.userObjectsMapAndFlag();const flags=mapAndFlag?mapAndFlag.map:null;const flag=mapAndFlag?mapAndFlag.flag:0;const nodesCount=postOrderIndex2NodeOrdinal.length;const rootPostOrderedIndex=nodesCount-1;const noEntry=nodesCount;const dominators=new Uint32Array(nodesCount);for(let i=0;i<rootPostOrderedIndex;++i){dominators[i]=noEntry;}
dominators[rootPostOrderedIndex]=rootPostOrderedIndex;const affected=new Uint8Array(nodesCount);let nodeOrdinal;{nodeOrdinal=this._rootNodeIndex/nodeFieldCount;const endEdgeIndex=firstEdgeIndexes[nodeOrdinal+1];for(let edgeIndex=firstEdgeIndexes[nodeOrdinal];edgeIndex<endEdgeIndex;edgeIndex+=edgeFieldsCount){const edgeType=containmentEdges[edgeIndex+edgeTypeOffset];if(!this._isEssentialEdge(this._rootNodeIndex,edgeType)){continue;}
const childNodeOrdinal=containmentEdges[edgeIndex+edgeToNodeOffset]/nodeFieldCount;affected[nodeOrdinal2PostOrderIndex[childNodeOrdinal]]=1;}}
let changed=true;while(changed){changed=false;for(let postOrderIndex=rootPostOrderedIndex-1;postOrderIndex>=0;--postOrderIndex){if(affected[postOrderIndex]===0){continue;}
affected[postOrderIndex]=0;if(dominators[postOrderIndex]===rootPostOrderedIndex){continue;}
nodeOrdinal=postOrderIndex2NodeOrdinal[postOrderIndex];const nodeFlag=!flags||(flags[nodeOrdinal]&flag);let newDominatorIndex=noEntry;const beginRetainerIndex=firstRetainerIndex[nodeOrdinal];const endRetainerIndex=firstRetainerIndex[nodeOrdinal+1];let orphanNode=true;for(let retainerIndex=beginRetainerIndex;retainerIndex<endRetainerIndex;++retainerIndex){const retainerEdgeIndex=retainingEdges[retainerIndex];const retainerEdgeType=containmentEdges[retainerEdgeIndex+edgeTypeOffset];const retainerNodeIndex=retainingNodes[retainerIndex];if(!this._isEssentialEdge(retainerNodeIndex,retainerEdgeType)){continue;}
orphanNode=false;const retainerNodeOrdinal=retainerNodeIndex/nodeFieldCount;const retainerNodeFlag=!flags||(flags[retainerNodeOrdinal]&flag);if(retainerNodeIndex!==rootNodeIndex&&nodeFlag&&!retainerNodeFlag){continue;}
let retanerPostOrderIndex=nodeOrdinal2PostOrderIndex[retainerNodeOrdinal];if(dominators[retanerPostOrderIndex]!==noEntry){if(newDominatorIndex===noEntry){newDominatorIndex=retanerPostOrderIndex;}else{while(retanerPostOrderIndex!==newDominatorIndex){while(retanerPostOrderIndex<newDominatorIndex){retanerPostOrderIndex=dominators[retanerPostOrderIndex];}
while(newDominatorIndex<retanerPostOrderIndex){newDominatorIndex=dominators[newDominatorIndex];}}}
if(newDominatorIndex===rootPostOrderedIndex){break;}}}
if(orphanNode){newDominatorIndex=rootPostOrderedIndex;}
if(newDominatorIndex!==noEntry&&dominators[postOrderIndex]!==newDominatorIndex){dominators[postOrderIndex]=newDominatorIndex;changed=true;nodeOrdinal=postOrderIndex2NodeOrdinal[postOrderIndex];const beginEdgeToNodeFieldIndex=firstEdgeIndexes[nodeOrdinal]+edgeToNodeOffset;const endEdgeToNodeFieldIndex=firstEdgeIndexes[nodeOrdinal+1];for(let toNodeFieldIndex=beginEdgeToNodeFieldIndex;toNodeFieldIndex<endEdgeToNodeFieldIndex;toNodeFieldIndex+=edgeFieldsCount){const childNodeOrdinal=containmentEdges[toNodeFieldIndex]/nodeFieldCount;affected[nodeOrdinal2PostOrderIndex[childNodeOrdinal]]=1;}}}}
const dominatorsTree=new Uint32Array(nodesCount);for(let postOrderIndex=0,l=dominators.length;postOrderIndex<l;++postOrderIndex){nodeOrdinal=postOrderIndex2NodeOrdinal[postOrderIndex];dominatorsTree[nodeOrdinal]=postOrderIndex2NodeOrdinal[dominators[postOrderIndex]];}
return dominatorsTree;}
_calculateRetainedSizes(postOrderIndex2NodeOrdinal){const nodeCount=this.nodeCount;const nodes=this.nodes;const nodeSelfSizeOffset=this._nodeSelfSizeOffset;const nodeFieldCount=this._nodeFieldCount;const dominatorsTree=this._dominatorsTree;const retainedSizes=this._retainedSizes;for(let nodeOrdinal=0;nodeOrdinal<nodeCount;++nodeOrdinal){retainedSizes[nodeOrdinal]=nodes[nodeOrdinal*nodeFieldCount+nodeSelfSizeOffset];}
for(let postOrderIndex=0;postOrderIndex<nodeCount-1;++postOrderIndex){const nodeOrdinal=postOrderIndex2NodeOrdinal[postOrderIndex];const dominatorOrdinal=dominatorsTree[nodeOrdinal];retainedSizes[dominatorOrdinal]+=retainedSizes[nodeOrdinal];}}
_buildDominatedNodes(){const indexArray=this._firstDominatedNodeIndex;const dominatedNodes=this._dominatedNodes;const nodeFieldCount=this._nodeFieldCount;const dominatorsTree=this._dominatorsTree;let fromNodeOrdinal=0;let toNodeOrdinal=this.nodeCount;const rootNodeOrdinal=this._rootNodeIndex/nodeFieldCount;if(rootNodeOrdinal===fromNodeOrdinal){fromNodeOrdinal=1;}else if(rootNodeOrdinal===toNodeOrdinal-1){toNodeOrdinal=toNodeOrdinal-1;}else{throw new Error('Root node is expected to be either first or last');}
for(let nodeOrdinal=fromNodeOrdinal;nodeOrdinal<toNodeOrdinal;++nodeOrdinal){++indexArray[dominatorsTree[nodeOrdinal]];}
let firstDominatedNodeIndex=0;for(let i=0,l=this.nodeCount;i<l;++i){const dominatedCount=dominatedNodes[firstDominatedNodeIndex]=indexArray[i];indexArray[i]=firstDominatedNodeIndex;firstDominatedNodeIndex+=dominatedCount;}
indexArray[this.nodeCount]=dominatedNodes.length;for(let nodeOrdinal=fromNodeOrdinal;nodeOrdinal<toNodeOrdinal;++nodeOrdinal){const dominatorOrdinal=dominatorsTree[nodeOrdinal];let dominatedRefIndex=indexArray[dominatorOrdinal];dominatedRefIndex+=(--dominatedNodes[dominatedRefIndex]);dominatedNodes[dominatedRefIndex]=nodeOrdinal*nodeFieldCount;}}
_buildSamples(){const samples=this._rawSamples;if(!samples||!samples.length){return;}
const sampleCount=samples.length/2;const sizeForRange=new Array(sampleCount);const timestamps=new Array(sampleCount);const lastAssignedIds=new Array(sampleCount);const timestampOffset=this._metaNode.sample_fields.indexOf('timestamp_us');const lastAssignedIdOffset=this._metaNode.sample_fields.indexOf('last_assigned_id');for(let i=0;i<sampleCount;i++){sizeForRange[i]=0;timestamps[i]=(samples[2*i+timestampOffset])/1000;lastAssignedIds[i]=samples[2*i+lastAssignedIdOffset];}
const nodes=this.nodes;const nodesLength=nodes.length;const nodeFieldCount=this._nodeFieldCount;const node=this.rootNode();for(let nodeIndex=0;nodeIndex<nodesLength;nodeIndex+=nodeFieldCount){node.nodeIndex=nodeIndex;const nodeId=node.id();if(nodeId%2===0){continue;}
const rangeIndex=lastAssignedIds.lowerBound(nodeId);if(rangeIndex===sampleCount){continue;}
sizeForRange[rangeIndex]+=node.selfSize();}
this._samples=new HeapSnapshotModel.Samples(timestamps,lastAssignedIds,sizeForRange);}
_buildLocationMap(){const map=new Map();const locations=this._locations;for(let i=0;i<locations.length;i+=this._locationFieldCount){const nodeIndex=locations[i+this._locationIndexOffset];const scriptId=locations[i+this._locationScriptIdOffset];const line=locations[i+this._locationLineOffset];const col=locations[i+this._locationColumnOffset];map.set(nodeIndex,new HeapSnapshotModel.Location(scriptId,line,col));}
this._locationMap=map;}
getLocation(nodeIndex){return this._locationMap.get(nodeIndex)||null;}
getSamples(){return this._samples;}
calculateFlags(){throw new Error('Not implemented');}
calculateStatistics(){throw new Error('Not implemented');}
userObjectsMapAndFlag(){throw new Error('Not implemented');}
calculateSnapshotDiff(baseSnapshotId,baseSnapshotAggregates){let snapshotDiff=this._snapshotDiffs[baseSnapshotId];if(snapshotDiff){return snapshotDiff;}
snapshotDiff={};const aggregates=this.aggregates(true,'allObjects');for(const className in baseSnapshotAggregates){const baseAggregate=baseSnapshotAggregates[className];const diff=this._calculateDiffForClass(baseAggregate,aggregates[className]);if(diff){snapshotDiff[className]=diff;}}
const emptyBaseAggregate=new HeapSnapshotModel.AggregateForDiff();for(const className in aggregates){if(className in baseSnapshotAggregates){continue;}
snapshotDiff[className]=this._calculateDiffForClass(emptyBaseAggregate,aggregates[className]);}
this._snapshotDiffs[baseSnapshotId]=snapshotDiff;return snapshotDiff;}
_calculateDiffForClass(baseAggregate,aggregate){const baseIds=baseAggregate.ids;const baseIndexes=baseAggregate.indexes;const baseSelfSizes=baseAggregate.selfSizes;const indexes=aggregate?aggregate.idxs:[];let i=0;let j=0;const l=baseIds.length;const m=indexes.length;const diff=new HeapSnapshotModel.Diff();const nodeB=this.createNode(indexes[j]);while(i<l&&j<m){const nodeAId=baseIds[i];if(nodeAId<nodeB.id()){diff.deletedIndexes.push(baseIndexes[i]);diff.removedCount++;diff.removedSize+=baseSelfSizes[i];++i;}else if(nodeAId>nodeB.id()){diff.addedIndexes.push(indexes[j]);diff.addedCount++;diff.addedSize+=nodeB.selfSize();nodeB.nodeIndex=indexes[++j];}else{++i;nodeB.nodeIndex=indexes[++j];}}
while(i<l){diff.deletedIndexes.push(baseIndexes[i]);diff.removedCount++;diff.removedSize+=baseSelfSizes[i];++i;}
while(j<m){diff.addedIndexes.push(indexes[j]);diff.addedCount++;diff.addedSize+=nodeB.selfSize();nodeB.nodeIndex=indexes[++j];}
diff.countDelta=diff.addedCount-diff.removedCount;diff.sizeDelta=diff.addedSize-diff.removedSize;if(!diff.addedCount&&!diff.removedCount){return null;}
return diff;}
_nodeForSnapshotObjectId(snapshotObjectId){for(let it=this._allNodes();it.hasNext();it.next()){if(it.node.id()===snapshotObjectId){return it.node;}}
return null;}
nodeClassName(snapshotObjectId){const node=this._nodeForSnapshotObjectId(snapshotObjectId);if(node){return node.className();}
return null;}
idsOfObjectsWithName(name){const ids=[];for(let it=this._allNodes();it.hasNext();it.next()){if(it.item().name()===name){ids.push(it.item().id());}}
return ids;}
createEdgesProvider(nodeIndex){const node=this.createNode(nodeIndex);const filter=this.containmentEdgesFilter();const indexProvider=new HeapSnapshotWorker.HeapSnapshotEdgeIndexProvider(this);return new HeapSnapshotWorker.HeapSnapshotEdgesProvider(this,filter,node.edges(),indexProvider);}
createEdgesProviderForTest(nodeIndex,filter){const node=this.createNode(nodeIndex);const indexProvider=new HeapSnapshotWorker.HeapSnapshotEdgeIndexProvider(this);return new HeapSnapshotWorker.HeapSnapshotEdgesProvider(this,filter,node.edges(),indexProvider);}
retainingEdgesFilter(){return null;}
containmentEdgesFilter(){return null;}
createRetainingEdgesProvider(nodeIndex){const node=this.createNode(nodeIndex);const filter=this.retainingEdgesFilter();const indexProvider=new HeapSnapshotWorker.HeapSnapshotRetainerEdgeIndexProvider(this);return new HeapSnapshotWorker.HeapSnapshotEdgesProvider(this,filter,node.retainers(),indexProvider);}
createAddedNodesProvider(baseSnapshotId,className){const snapshotDiff=this._snapshotDiffs[baseSnapshotId];const diffForClass=snapshotDiff[className];return new HeapSnapshotWorker.HeapSnapshotNodesProvider(this,diffForClass.addedIndexes);}
createDeletedNodesProvider(nodeIndexes){return new HeapSnapshotWorker.HeapSnapshotNodesProvider(this,nodeIndexes);}
createNodesProviderForClass(className,nodeFilter){return new HeapSnapshotWorker.HeapSnapshotNodesProvider(this,this.aggregatesWithFilter(nodeFilter)[className].idxs);}
_maxJsNodeId(){const nodeFieldCount=this._nodeFieldCount;const nodes=this.nodes;const nodesLength=nodes.length;let id=0;for(let nodeIndex=this._nodeIdOffset;nodeIndex<nodesLength;nodeIndex+=nodeFieldCount){const nextId=nodes[nodeIndex];if(nextId%2===0){continue;}
if(id<nextId){id=nextId;}}
return id;}
updateStaticData(){return new HeapSnapshotModel.StaticData(this.nodeCount,this._rootNodeIndex,this.totalSize,this._maxJsNodeId());}};HeapSnapshotWorker.HeapSnapshot.AggregatedInfo;const HeapSnapshotMetainfo=class{constructor(){this.node_fields=[];this.node_types=[];this.edge_fields=[];this.edge_types=[];this.trace_function_info_fields=[];this.trace_node_fields=[];this.sample_fields=[];this.type_strings={};}};HeapSnapshotWorker.HeapSnapshotHeader=class{constructor(){this.title='';this.meta=new HeapSnapshotMetainfo();this.node_count=0;this.edge_count=0;this.trace_function_count=0;}};HeapSnapshotWorker.HeapSnapshotItemProvider=class{constructor(iterator,indexProvider){this._iterator=iterator;this._indexProvider=indexProvider;this._isEmpty=!iterator.hasNext();this._iterationOrder=null;this._currentComparator=null;this._sortedPrefixLength=0;this._sortedSuffixLength=0;}
_createIterationOrder(){if(this._iterationOrder){return;}
this._iterationOrder=[];for(let iterator=this._iterator;iterator.hasNext();iterator.next()){this._iterationOrder.push(iterator.item().itemIndex());}}
isEmpty(){return this._isEmpty;}
serializeItemsRange(begin,end){this._createIterationOrder();if(begin>end){throw new Error('Start position > end position: '+begin+' > '+end);}
if(end>this._iterationOrder.length){end=this._iterationOrder.length;}
if(this._sortedPrefixLength<end&&begin<this._iterationOrder.length-this._sortedSuffixLength){this.sort(this._currentComparator,this._sortedPrefixLength,this._iterationOrder.length-1-this._sortedSuffixLength,begin,end-1);if(begin<=this._sortedPrefixLength){this._sortedPrefixLength=end;}
if(end>=this._iterationOrder.length-this._sortedSuffixLength){this._sortedSuffixLength=this._iterationOrder.length-begin;}}
let position=begin;const count=end-begin;const result=new Array(count);for(let i=0;i<count;++i){const itemIndex=this._iterationOrder[position++];const item=this._indexProvider.itemForIndex(itemIndex);result[i]=item.serialize();}
return new HeapSnapshotModel.ItemsRange(begin,end,this._iterationOrder.length,result);}
sortAndRewind(comparator){this._currentComparator=comparator;this._sortedPrefixLength=0;this._sortedSuffixLength=0;}};HeapSnapshotWorker.HeapSnapshotEdgesProvider=class extends HeapSnapshotWorker.HeapSnapshotItemProvider{constructor(snapshot,filter,edgesIter,indexProvider){const iter=filter?new HeapSnapshotWorker.HeapSnapshotFilteredIterator(edgesIter,(filter)):edgesIter;super(iter,indexProvider);this.snapshot=snapshot;}
sort(comparator,leftBound,rightBound,windowLeft,windowRight){const fieldName1=comparator.fieldName1;const fieldName2=comparator.fieldName2;const ascending1=comparator.ascending1;const ascending2=comparator.ascending2;const edgeA=this._iterator.item().clone();const edgeB=edgeA.clone();const nodeA=this.snapshot.createNode();const nodeB=this.snapshot.createNode();function compareEdgeFieldName(ascending,indexA,indexB){edgeA.edgeIndex=indexA;edgeB.edgeIndex=indexB;if(edgeB.name()==='__proto__'){return-1;}
if(edgeA.name()==='__proto__'){return 1;}
const result=edgeA.hasStringName()===edgeB.hasStringName()?(edgeA.name()<edgeB.name()?-1:(edgeA.name()>edgeB.name()?1:0)):(edgeA.hasStringName()?-1:1);return ascending?result:-result;}
function compareNodeField(fieldName,ascending,indexA,indexB){edgeA.edgeIndex=indexA;nodeA.nodeIndex=edgeA.nodeIndex();const valueA=nodeA[fieldName]();edgeB.edgeIndex=indexB;nodeB.nodeIndex=edgeB.nodeIndex();const valueB=nodeB[fieldName]();const result=valueA<valueB?-1:(valueA>valueB?1:0);return ascending?result:-result;}
function compareEdgeAndNode(indexA,indexB){let result=compareEdgeFieldName(ascending1,indexA,indexB);if(result===0){result=compareNodeField(fieldName2,ascending2,indexA,indexB);}
if(result===0){return indexA-indexB;}
return result;}
function compareNodeAndEdge(indexA,indexB){let result=compareNodeField(fieldName1,ascending1,indexA,indexB);if(result===0){result=compareEdgeFieldName(ascending2,indexA,indexB);}
if(result===0){return indexA-indexB;}
return result;}
function compareNodeAndNode(indexA,indexB){let result=compareNodeField(fieldName1,ascending1,indexA,indexB);if(result===0){result=compareNodeField(fieldName2,ascending2,indexA,indexB);}
if(result===0){return indexA-indexB;}
return result;}
if(fieldName1==='!edgeName'){this._iterationOrder.sortRange(compareEdgeAndNode,leftBound,rightBound,windowLeft,windowRight);}else if(fieldName2==='!edgeName'){this._iterationOrder.sortRange(compareNodeAndEdge,leftBound,rightBound,windowLeft,windowRight);}else{this._iterationOrder.sortRange(compareNodeAndNode,leftBound,rightBound,windowLeft,windowRight);}}};HeapSnapshotWorker.HeapSnapshotNodesProvider=class extends HeapSnapshotWorker.HeapSnapshotItemProvider{constructor(snapshot,nodeIndexes){const indexProvider=new HeapSnapshotWorker.HeapSnapshotNodeIndexProvider(snapshot);const it=new HeapSnapshotWorker.HeapSnapshotIndexRangeIterator(indexProvider,nodeIndexes);super(it,indexProvider);this.snapshot=snapshot;}
nodePosition(snapshotObjectId){this._createIterationOrder();const node=this.snapshot.createNode();let i=0;for(;i<this._iterationOrder.length;i++){node.nodeIndex=this._iterationOrder[i];if(node.id()===snapshotObjectId){break;}}
if(i===this._iterationOrder.length){return-1;}
const targetNodeIndex=this._iterationOrder[i];let smallerCount=0;const compare=this._buildCompareFunction(this._currentComparator);for(let i=0;i<this._iterationOrder.length;i++){if(compare(this._iterationOrder[i],targetNodeIndex)<0){++smallerCount;}}
return smallerCount;}
_buildCompareFunction(comparator){const nodeA=this.snapshot.createNode();const nodeB=this.snapshot.createNode();const fieldAccessor1=nodeA[comparator.fieldName1];const fieldAccessor2=nodeA[comparator.fieldName2];const ascending1=comparator.ascending1?1:-1;const ascending2=comparator.ascending2?1:-1;function sortByNodeField(fieldAccessor,ascending){const valueA=fieldAccessor.call(nodeA);const valueB=fieldAccessor.call(nodeB);return valueA<valueB?-ascending:(valueA>valueB?ascending:0);}
function sortByComparator(indexA,indexB){nodeA.nodeIndex=indexA;nodeB.nodeIndex=indexB;let result=sortByNodeField(fieldAccessor1,ascending1);if(result===0){result=sortByNodeField(fieldAccessor2,ascending2);}
return result||indexA-indexB;}
return sortByComparator;}
sort(comparator,leftBound,rightBound,windowLeft,windowRight){this._iterationOrder.sortRange(this._buildCompareFunction(comparator),leftBound,rightBound,windowLeft,windowRight);}};HeapSnapshotWorker.JSHeapSnapshot=class extends HeapSnapshotWorker.HeapSnapshot{constructor(profile,progress){super(profile,progress);this._nodeFlags={canBeQueried:1,detachedDOMTreeNode:2,pageObject:4};this._lazyStringCache={};this.initialize();}
createNode(nodeIndex){return new HeapSnapshotWorker.JSHeapSnapshotNode(this,nodeIndex===undefined?-1:nodeIndex);}
createEdge(edgeIndex){return new HeapSnapshotWorker.JSHeapSnapshotEdge(this,edgeIndex);}
createRetainingEdge(retainerIndex){return new HeapSnapshotWorker.JSHeapSnapshotRetainerEdge(this,retainerIndex);}
containmentEdgesFilter(){return edge=>!edge.isInvisible();}
retainingEdgesFilter(){const containmentEdgesFilter=this.containmentEdgesFilter();function filter(edge){return containmentEdgesFilter(edge)&&!edge.node().isRoot()&&!edge.isWeak();}
return filter;}
calculateFlags(){this._flags=new Uint32Array(this.nodeCount);this._markDetachedDOMTreeNodes();this._markQueriableHeapObjects();this._markPageOwnedNodes();}
calculateDistances(){function filter(node,edge){if(node.isHidden()){return edge.name()!=='sloppy_function_map'||node.rawName()!=='system / NativeContext';}
if(node.isArray()){if(node.rawName()!=='(map descriptors)'){return true;}
const index=edge.name();return index<2||(index%3)!==1;}
return true;}
super.calculateDistances(filter);}
isUserRoot(node){return node.isUserRoot()||node.isDocumentDOMTreesRoot();}
userObjectsMapAndFlag(){return{map:this._flags,flag:this._nodeFlags.pageObject};}
_flagsOfNode(node){return this._flags[node.nodeIndex/this._nodeFieldCount];}
_markDetachedDOMTreeNodes(){const nodes=this.nodes;const nodesLength=nodes.length;const nodeFieldCount=this._nodeFieldCount;const nodeNativeType=this._nodeNativeType;const nodeTypeOffset=this._nodeTypeOffset;const flag=this._nodeFlags.detachedDOMTreeNode;const node=this.rootNode();for(let nodeIndex=0,ordinal=0;nodeIndex<nodesLength;nodeIndex+=nodeFieldCount,ordinal++){const nodeType=nodes[nodeIndex+nodeTypeOffset];if(nodeType!==nodeNativeType){continue;}
node.nodeIndex=nodeIndex;if(node.name().startsWith('Detached ')){this._flags[ordinal]|=flag;}}}
_markQueriableHeapObjects(){const flag=this._nodeFlags.canBeQueried;const hiddenEdgeType=this._edgeHiddenType;const internalEdgeType=this._edgeInternalType;const invisibleEdgeType=this._edgeInvisibleType;const weakEdgeType=this._edgeWeakType;const edgeToNodeOffset=this._edgeToNodeOffset;const edgeTypeOffset=this._edgeTypeOffset;const edgeFieldsCount=this._edgeFieldsCount;const containmentEdges=this.containmentEdges;const nodeFieldCount=this._nodeFieldCount;const firstEdgeIndexes=this._firstEdgeIndexes;const flags=this._flags;const list=[];for(let iter=this.rootNode().edges();iter.hasNext();iter.next()){if(iter.edge.node().isUserRoot()){list.push(iter.edge.node().nodeIndex/nodeFieldCount);}}
while(list.length){const nodeOrdinal=list.pop();if(flags[nodeOrdinal]&flag){continue;}
flags[nodeOrdinal]|=flag;const beginEdgeIndex=firstEdgeIndexes[nodeOrdinal];const endEdgeIndex=firstEdgeIndexes[nodeOrdinal+1];for(let edgeIndex=beginEdgeIndex;edgeIndex<endEdgeIndex;edgeIndex+=edgeFieldsCount){const childNodeIndex=containmentEdges[edgeIndex+edgeToNodeOffset];const childNodeOrdinal=childNodeIndex/nodeFieldCount;if(flags[childNodeOrdinal]&flag){continue;}
const type=containmentEdges[edgeIndex+edgeTypeOffset];if(type===hiddenEdgeType||type===invisibleEdgeType||type===internalEdgeType||type===weakEdgeType){continue;}
list.push(childNodeOrdinal);}}}
_markPageOwnedNodes(){const edgeShortcutType=this._edgeShortcutType;const edgeElementType=this._edgeElementType;const edgeToNodeOffset=this._edgeToNodeOffset;const edgeTypeOffset=this._edgeTypeOffset;const edgeFieldsCount=this._edgeFieldsCount;const edgeWeakType=this._edgeWeakType;const firstEdgeIndexes=this._firstEdgeIndexes;const containmentEdges=this.containmentEdges;const nodeFieldCount=this._nodeFieldCount;const nodesCount=this.nodeCount;const flags=this._flags;const pageObjectFlag=this._nodeFlags.pageObject;const nodesToVisit=new Uint32Array(nodesCount);let nodesToVisitLength=0;const rootNodeOrdinal=this._rootNodeIndex/nodeFieldCount;const node=this.rootNode();for(let edgeIndex=firstEdgeIndexes[rootNodeOrdinal],endEdgeIndex=firstEdgeIndexes[rootNodeOrdinal+1];edgeIndex<endEdgeIndex;edgeIndex+=edgeFieldsCount){const edgeType=containmentEdges[edgeIndex+edgeTypeOffset];const nodeIndex=containmentEdges[edgeIndex+edgeToNodeOffset];if(edgeType===edgeElementType){node.nodeIndex=nodeIndex;if(!node.isDocumentDOMTreesRoot()){continue;}}else if(edgeType!==edgeShortcutType){continue;}
const nodeOrdinal=nodeIndex/nodeFieldCount;nodesToVisit[nodesToVisitLength++]=nodeOrdinal;flags[nodeOrdinal]|=pageObjectFlag;}
while(nodesToVisitLength){const nodeOrdinal=nodesToVisit[--nodesToVisitLength];const beginEdgeIndex=firstEdgeIndexes[nodeOrdinal];const endEdgeIndex=firstEdgeIndexes[nodeOrdinal+1];for(let edgeIndex=beginEdgeIndex;edgeIndex<endEdgeIndex;edgeIndex+=edgeFieldsCount){const childNodeIndex=containmentEdges[edgeIndex+edgeToNodeOffset];const childNodeOrdinal=childNodeIndex/nodeFieldCount;if(flags[childNodeOrdinal]&pageObjectFlag){continue;}
const type=containmentEdges[edgeIndex+edgeTypeOffset];if(type===edgeWeakType){continue;}
nodesToVisit[nodesToVisitLength++]=childNodeOrdinal;flags[childNodeOrdinal]|=pageObjectFlag;}}}
calculateStatistics(){const nodeFieldCount=this._nodeFieldCount;const nodes=this.nodes;const nodesLength=nodes.length;const nodeTypeOffset=this._nodeTypeOffset;const nodeSizeOffset=this._nodeSelfSizeOffset;const nodeNativeType=this._nodeNativeType;const nodeCodeType=this._nodeCodeType;const nodeConsStringType=this._nodeConsStringType;const nodeSlicedStringType=this._nodeSlicedStringType;const distances=this._nodeDistances;let sizeNative=0;let sizeCode=0;let sizeStrings=0;let sizeJSArrays=0;let sizeSystem=0;const node=this.rootNode();for(let nodeIndex=0;nodeIndex<nodesLength;nodeIndex+=nodeFieldCount){const nodeSize=nodes[nodeIndex+nodeSizeOffset];const ordinal=nodeIndex/nodeFieldCount;if(distances[ordinal]>=HeapSnapshotModel.baseSystemDistance){sizeSystem+=nodeSize;continue;}
const nodeType=nodes[nodeIndex+nodeTypeOffset];node.nodeIndex=nodeIndex;if(nodeType===nodeNativeType){sizeNative+=nodeSize;}else if(nodeType===nodeCodeType){sizeCode+=nodeSize;}else if(nodeType===nodeConsStringType||nodeType===nodeSlicedStringType||node.type()==='string'){sizeStrings+=nodeSize;}else if(node.name()==='Array'){sizeJSArrays+=this._calculateArraySize(node);}}
this._statistics=new HeapSnapshotModel.Statistics();this._statistics.total=this.totalSize;this._statistics.v8heap=this.totalSize-sizeNative;this._statistics.native=sizeNative;this._statistics.code=sizeCode;this._statistics.jsArrays=sizeJSArrays;this._statistics.strings=sizeStrings;this._statistics.system=sizeSystem;}
_calculateArraySize(node){let size=node.selfSize();const beginEdgeIndex=node.edgeIndexesStart();const endEdgeIndex=node.edgeIndexesEnd();const containmentEdges=this.containmentEdges;const strings=this.strings;const edgeToNodeOffset=this._edgeToNodeOffset;const edgeTypeOffset=this._edgeTypeOffset;const edgeNameOffset=this._edgeNameOffset;const edgeFieldsCount=this._edgeFieldsCount;const edgeInternalType=this._edgeInternalType;for(let edgeIndex=beginEdgeIndex;edgeIndex<endEdgeIndex;edgeIndex+=edgeFieldsCount){const edgeType=containmentEdges[edgeIndex+edgeTypeOffset];if(edgeType!==edgeInternalType){continue;}
const edgeName=strings[containmentEdges[edgeIndex+edgeNameOffset]];if(edgeName!=='elements'){continue;}
const elementsNodeIndex=containmentEdges[edgeIndex+edgeToNodeOffset];node.nodeIndex=elementsNodeIndex;if(node.retainersCount()===1){size+=node.selfSize();}
break;}
return size;}
getStatistics(){return this._statistics;}};HeapSnapshotWorker.JSHeapSnapshotNode=class extends HeapSnapshotWorker.HeapSnapshotNode{constructor(snapshot,nodeIndex){super(snapshot,nodeIndex);}
canBeQueried(){const flags=this._snapshot._flagsOfNode(this);return!!(flags&this._snapshot._nodeFlags.canBeQueried);}
rawName(){return super.name();}
name(){const snapshot=this._snapshot;if(this.rawType()===snapshot._nodeConsStringType){let string=snapshot._lazyStringCache[this.nodeIndex];if(typeof string==='undefined'){string=this._consStringName();snapshot._lazyStringCache[this.nodeIndex]=string;}
return string;}
return this.rawName();}
_consStringName(){const snapshot=this._snapshot;const consStringType=snapshot._nodeConsStringType;const edgeInternalType=snapshot._edgeInternalType;const edgeFieldsCount=snapshot._edgeFieldsCount;const edgeToNodeOffset=snapshot._edgeToNodeOffset;const edgeTypeOffset=snapshot._edgeTypeOffset;const edgeNameOffset=snapshot._edgeNameOffset;const strings=snapshot.strings;const edges=snapshot.containmentEdges;const firstEdgeIndexes=snapshot._firstEdgeIndexes;const nodeFieldCount=snapshot._nodeFieldCount;const nodeTypeOffset=snapshot._nodeTypeOffset;const nodeNameOffset=snapshot._nodeNameOffset;const nodes=snapshot.nodes;const nodesStack=[];nodesStack.push(this.nodeIndex);let name='';while(nodesStack.length&&name.length<1024){const nodeIndex=nodesStack.pop();if(nodes[nodeIndex+nodeTypeOffset]!==consStringType){name+=strings[nodes[nodeIndex+nodeNameOffset]];continue;}
const nodeOrdinal=nodeIndex/nodeFieldCount;const beginEdgeIndex=firstEdgeIndexes[nodeOrdinal];const endEdgeIndex=firstEdgeIndexes[nodeOrdinal+1];let firstNodeIndex=0;let secondNodeIndex=0;for(let edgeIndex=beginEdgeIndex;edgeIndex<endEdgeIndex&&(!firstNodeIndex||!secondNodeIndex);edgeIndex+=edgeFieldsCount){const edgeType=edges[edgeIndex+edgeTypeOffset];if(edgeType===edgeInternalType){const edgeName=strings[edges[edgeIndex+edgeNameOffset]];if(edgeName==='first'){firstNodeIndex=edges[edgeIndex+edgeToNodeOffset];}else if(edgeName==='second'){secondNodeIndex=edges[edgeIndex+edgeToNodeOffset];}}}
nodesStack.push(secondNodeIndex);nodesStack.push(firstNodeIndex);}
return name;}
className(){const type=this.type();switch(type){case'hidden':return'(system)';case'object':case'native':return this.name();case'code':return'(compiled code)';default:return'('+type+')';}}
classIndex(){const snapshot=this._snapshot;const nodes=snapshot.nodes;const type=nodes[this.nodeIndex+snapshot._nodeTypeOffset];if(type===snapshot._nodeObjectType||type===snapshot._nodeNativeType){return nodes[this.nodeIndex+snapshot._nodeNameOffset];}
return-1-type;}
id(){const snapshot=this._snapshot;return snapshot.nodes[this.nodeIndex+snapshot._nodeIdOffset];}
isHidden(){return this.rawType()===this._snapshot._nodeHiddenType;}
isArray(){return this.rawType()===this._snapshot._nodeArrayType;}
isSynthetic(){return this.rawType()===this._snapshot._nodeSyntheticType;}
isUserRoot(){return!this.isSynthetic();}
isDocumentDOMTreesRoot(){return this.isSynthetic()&&this.name()==='(Document DOM trees)';}
serialize(){const result=super.serialize();const flags=this._snapshot._flagsOfNode(this);if(flags&this._snapshot._nodeFlags.canBeQueried){result.canBeQueried=true;}
if(flags&this._snapshot._nodeFlags.detachedDOMTreeNode){result.detachedDOMTreeNode=true;}
return result;}};HeapSnapshotWorker.JSHeapSnapshotEdge=class extends HeapSnapshotWorker.HeapSnapshotEdge{constructor(snapshot,edgeIndex){super(snapshot,edgeIndex);}
clone(){const snapshot=(this._snapshot);return new HeapSnapshotWorker.JSHeapSnapshotEdge(snapshot,this.edgeIndex);}
hasStringName(){if(!this.isShortcut()){return this._hasStringName();}
return isNaN(parseInt(this._name(),10));}
isElement(){return this.rawType()===this._snapshot._edgeElementType;}
isHidden(){return this.rawType()===this._snapshot._edgeHiddenType;}
isWeak(){return this.rawType()===this._snapshot._edgeWeakType;}
isInternal(){return this.rawType()===this._snapshot._edgeInternalType;}
isInvisible(){return this.rawType()===this._snapshot._edgeInvisibleType;}
isShortcut(){return this.rawType()===this._snapshot._edgeShortcutType;}
name(){const name=this._name();if(!this.isShortcut()){return String(name);}
const numName=parseInt(name,10);return String(isNaN(numName)?name:numName);}
toString(){const name=this.name();switch(this.type()){case'context':return'->'+name;case'element':return'['+name+']';case'weak':return'[['+name+']]';case'property':return name.indexOf(' ')===-1?'.'+name:'["'+name+'"]';case'shortcut':if(typeof name==='string'){return name.indexOf(' ')===-1?'.'+name:'["'+name+'"]';}else{return'['+name+']';}
case'internal':case'hidden':case'invisible':return'{'+name+'}';}
return'?'+name+'?';}
_hasStringName(){const type=this.rawType();const snapshot=this._snapshot;return type!==snapshot._edgeElementType&&type!==snapshot._edgeHiddenType;}
_name(){return this._hasStringName()?this._snapshot.strings[this._nameOrIndex()]:this._nameOrIndex();}
_nameOrIndex(){return this._edges[this.edgeIndex+this._snapshot._edgeNameOffset];}
rawType(){return this._edges[this.edgeIndex+this._snapshot._edgeTypeOffset];}};HeapSnapshotWorker.JSHeapSnapshotRetainerEdge=class extends HeapSnapshotWorker.HeapSnapshotRetainerEdge{constructor(snapshot,retainerIndex){super(snapshot,retainerIndex);}
clone(){const snapshot=(this._snapshot);return new HeapSnapshotWorker.JSHeapSnapshotRetainerEdge(snapshot,this.retainerIndex());}
isHidden(){return this._edge().isHidden();}
isInternal(){return this._edge().isInternal();}
isInvisible(){return this._edge().isInvisible();}
isShortcut(){return this._edge().isShortcut();}
isWeak(){return this._edge().isWeak();}};(function disableLoggingForTest(){if(self.Root&&self.Root.Runtime&&Root.Runtime.queryParam('test')){console.warn=()=>undefined;}})();;HeapSnapshotWorker.HeapSnapshotLoader=class{constructor(dispatcher){this._reset();this._progress=new HeapSnapshotWorker.HeapSnapshotProgress(dispatcher);this._buffer='';this._dataCallback=null;this._done=false;this._parseInput();}
dispose(){this._reset();}
_reset(){this._json='';this._snapshot={};}
close(){this._done=true;if(this._dataCallback){this._dataCallback('');}}
buildSnapshot(){this._progress.updateStatus(ls`Processing snapshot\u2026`);const result=new HeapSnapshotWorker.JSHeapSnapshot(this._snapshot,this._progress);this._reset();return result;}
_parseUintArray(){let index=0;const char0='0'.charCodeAt(0);const char9='9'.charCodeAt(0);const closingBracket=']'.charCodeAt(0);const length=this._json.length;while(true){while(index<length){const code=this._json.charCodeAt(index);if(char0<=code&&code<=char9){break;}else if(code===closingBracket){this._json=this._json.slice(index+1);return false;}
++index;}
if(index===length){this._json='';return true;}
let nextNumber=0;const startIndex=index;while(index<length){const code=this._json.charCodeAt(index);if(char0>code||code>char9){break;}
nextNumber*=10;nextNumber+=(code-char0);++index;}
if(index===length){this._json=this._json.slice(startIndex);return true;}
this._array[this._arrayIndex++]=nextNumber;}}
_parseStringsArray(){this._progress.updateStatus(ls`Parsing strings\u2026`);const closingBracketIndex=this._json.lastIndexOf(']');if(closingBracketIndex===-1){throw new Error('Incomplete JSON');}
this._json=this._json.slice(0,closingBracketIndex+1);this._snapshot.strings=JSON.parse(this._json);}
write(chunk){this._buffer+=chunk;if(!this._dataCallback){return;}
this._dataCallback(this._buffer);this._dataCallback=null;this._buffer='';}
_fetchChunk(){return this._done?Promise.resolve(this._buffer):new Promise(r=>this._dataCallback=r);}
async _findToken(token,startIndex){while(true){const pos=this._json.indexOf(token,startIndex||0);if(pos!==-1){return pos;}
startIndex=this._json.length-token.length+1;this._json+=await this._fetchChunk();}}
async _parseArray(name,title,length){const nameIndex=await this._findToken(name);const bracketIndex=await this._findToken('[',nameIndex);this._json=this._json.slice(bracketIndex+1);this._array=length?new Uint32Array(length):[];this._arrayIndex=0;while(this._parseUintArray()){this._progress.updateProgress(title,this._arrayIndex,this._array.length);this._json+=await this._fetchChunk();}
const result=this._array;this._array=null;return result;}
async _parseInput(){const snapshotToken='"snapshot"';const snapshotTokenIndex=await this._findToken(snapshotToken);if(snapshotTokenIndex===-1){throw new Error('Snapshot token not found');}
this._progress.updateStatus(ls`Loading snapshot info\u2026`);const json=this._json.slice(snapshotTokenIndex+snapshotToken.length+1);this._jsonTokenizer=new TextUtils.TextUtils.BalancedJSONTokenizer(metaJSON=>{this._json=this._jsonTokenizer.remainder();this._jsonTokenizer=null;this._snapshot.snapshot=(JSON.parse(metaJSON));});this._jsonTokenizer.write(json);while(this._jsonTokenizer){this._jsonTokenizer.write(await this._fetchChunk());}
this._snapshot.nodes=await this._parseArray('"nodes"',ls`Loading nodes\u2026 %d%%`,this._snapshot.snapshot.meta.node_fields.length*this._snapshot.snapshot.node_count);this._snapshot.edges=await this._parseArray('"edges"',ls`Loading edges\u2026 %d%%`,this._snapshot.snapshot.meta.edge_fields.length*this._snapshot.snapshot.edge_count);if(this._snapshot.snapshot.trace_function_count){this._snapshot.trace_function_infos=await this._parseArray('"trace_function_infos"',ls`Loading allocation traces\u2026 %d%%`,this._snapshot.snapshot.meta.trace_function_info_fields.length*this._snapshot.snapshot.trace_function_count);const thisTokenEndIndex=await this._findToken(':');const nextTokenIndex=await this._findToken('"',thisTokenEndIndex);const openBracketIndex=this._json.indexOf('[');const closeBracketIndex=this._json.lastIndexOf(']',nextTokenIndex);this._snapshot.trace_tree=JSON.parse(this._json.substring(openBracketIndex,closeBracketIndex+1));this._json=this._json.slice(closeBracketIndex+1);}
if(this._snapshot.snapshot.meta.sample_fields){this._snapshot.samples=await this._parseArray('"samples"',ls`Loading samples\u2026`);}
if(this._snapshot.snapshot.meta['location_fields']){this._snapshot.locations=await this._parseArray('"locations"',ls`Loading locations\u2026`);}else{this._snapshot.locations=[];}
this._progress.updateStatus(ls`Loading strings\u2026`);const stringsTokenIndex=await this._findToken('"strings"');const bracketIndex=await this._findToken('[',stringsTokenIndex);this._json=this._json.slice(bracketIndex);while(!this._done){this._json+=await this._fetchChunk();}
this._parseStringsArray();}};;HeapSnapshotWorker.HeapSnapshotWorkerDispatcher=class{constructor(globalObject,postMessage){this._objects=[];this._global=globalObject;this._postMessage=postMessage;}
_findFunction(name){const path=name.split('.');let result=this._global;for(let i=0;i<path.length;++i){result=result[path[i]];}
return result;}
sendEvent(name,data){this._postMessage({eventName:name,data:data});}
dispatchMessage(event){const data=(event.data);const response={callId:data.callId};try{switch(data.disposition){case'create':const constructorFunction=this._findFunction(data.methodName);this._objects[data.objectId]=new constructorFunction(this);break;case'dispose':delete this._objects[data.objectId];break;case'getter':{const object=this._objects[data.objectId];const result=object[data.methodName];response.result=result;break;}
case'factory':{const object=this._objects[data.objectId];const result=object[data.methodName].apply(object,data.methodArguments);if(result){this._objects[data.newObjectId]=result;}
response.result=!!result;break;}
case'method':{const object=this._objects[data.objectId];response.result=object[data.methodName].apply(object,data.methodArguments);break;}
case'evaluateForTest':try{response.result=self.eval(data.source);}catch(e){response.result=e.toString();}
break;}}catch(e){response.error=e.toString();response.errorCallStack=e.stack;if(data.methodName){response.errorMethodName=data.methodName;}}
this._postMessage(response);}};;function postMessageWrapper(message){postMessage(message);}
const dispatcher=new HeapSnapshotWorker.HeapSnapshotWorkerDispatcher(this,postMessageWrapper);function installMessageEventListener(listener){self.addEventListener('message',listener,false);}
installMessageEventListener(dispatcher.dispatchMessage.bind(dispatcher));;