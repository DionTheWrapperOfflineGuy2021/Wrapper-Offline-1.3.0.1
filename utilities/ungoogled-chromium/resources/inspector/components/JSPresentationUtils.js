export function buildStackTracePreviewContents(target,linkifier,stackTrace,contentUpdated){const element=createElementWithClass('span','monospace');element.style.display='inline-block';const shadowRoot=UI.createShadowRootWithCoreStyles(element,'components/jsUtils.css');const contentElement=shadowRoot.createChild('table','stack-preview-container');let totalHiddenCallFramesCount=0;let totalCallFramesCount=0;const links=[];function appendStackTrace(stackTrace){let hiddenCallFrames=0;for(const stackFrame of stackTrace.callFrames){totalCallFramesCount++;let shouldHide=totalCallFramesCount>30&&stackTrace.callFrames.length>31;const row=createElement('tr');row.createChild('td').textContent='\n';row.createChild('td','function-name').textContent=UI.beautifyFunctionName(stackFrame.functionName);const link=linkifier.maybeLinkifyConsoleCallFrame(target,stackFrame);if(link){link.addEventListener('contextmenu',populateContextMenu.bind(null,link));const uiLocation=Components.Linkifier.uiLocation(link);if(uiLocation&&Bindings.blackboxManager.isBlackboxedUISourceCode(uiLocation.uiSourceCode)){shouldHide=true;}
row.createChild('td').textContent=' @ ';row.createChild('td').appendChild(link);links.push(link);}
if(shouldHide){row.classList.add('blackboxed');++hiddenCallFrames;}
contentElement.appendChild(row);}
totalHiddenCallFramesCount+=hiddenCallFrames;return stackTrace.callFrames.length===hiddenCallFrames;}
function populateContextMenu(link,event){const contextMenu=new UI.ContextMenu(event);event.consume(true);const uiLocation=Components.Linkifier.uiLocation(link);if(uiLocation&&Bindings.blackboxManager.canBlackboxUISourceCode(uiLocation.uiSourceCode)){if(Bindings.blackboxManager.isBlackboxedUISourceCode(uiLocation.uiSourceCode)){contextMenu.debugSection().appendItem(ls`Stop blackboxing`,()=>Bindings.blackboxManager.unblackboxUISourceCode(uiLocation.uiSourceCode));}else{contextMenu.debugSection().appendItem(ls`Blackbox script`,()=>Bindings.blackboxManager.blackboxUISourceCode(uiLocation.uiSourceCode));}}
contextMenu.appendApplicableItems(event);contextMenu.show();}
if(!stackTrace){return{element,links};}
appendStackTrace(stackTrace);let asyncStackTrace=stackTrace.parent;while(asyncStackTrace){if(!asyncStackTrace.callFrames.length){asyncStackTrace=asyncStackTrace.parent;continue;}
const row=contentElement.createChild('tr');row.createChild('td').textContent='\n';row.createChild('td','stack-preview-async-description').textContent=UI.asyncStackTraceLabel(asyncStackTrace.description);row.createChild('td');row.createChild('td');if(appendStackTrace(asyncStackTrace)){row.classList.add('blackboxed');}
asyncStackTrace=asyncStackTrace.parent;}
if(totalHiddenCallFramesCount){const row=contentElement.createChild('tr','show-blackboxed-link');row.createChild('td').textContent='\n';const cell=row.createChild('td');cell.colSpan=4;const showAllLink=cell.createChild('span','link');if(totalHiddenCallFramesCount===1){showAllLink.textContent=ls`Show 1 more frame`;}else{showAllLink.textContent=ls`Show ${totalHiddenCallFramesCount} more frames`;}
showAllLink.addEventListener('click',()=>{contentElement.classList.add('show-blackboxed');if(contentUpdated){contentUpdated();}},false);}
return{element,links};}
self.Components=self.Components||{};Components=Components||{};Components.JSPresentationUtils={};Components.JSPresentationUtils.buildStackTracePreviewContents=buildStackTracePreviewContents;