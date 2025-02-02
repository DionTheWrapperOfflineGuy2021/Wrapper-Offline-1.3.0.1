export default class CSSMatchedStyles{constructor(cssModel,node,inlinePayload,attributesPayload,matchedPayload,pseudoPayload,inheritedPayload,animationsPayload){this._cssModel=cssModel;this._node=node;this._addedStyles=new Map();this._matchingSelectors=new Map();this._keyframes=[];if(animationsPayload){this._keyframes=animationsPayload.map(rule=>new SDK.CSSKeyframesRule(cssModel,rule));}
this._nodeForStyle=new Map();this._inheritedStyles=new Set();matchedPayload=cleanUserAgentPayload(matchedPayload);for(const inheritedResult of inheritedPayload){inheritedResult.matchedCSSRules=cleanUserAgentPayload(inheritedResult.matchedCSSRules);}
this._mainDOMCascade=this._buildMainCascade(inlinePayload,attributesPayload,matchedPayload,inheritedPayload);this._pseudoDOMCascades=this._buildPseudoCascades(pseudoPayload);this._styleToDOMCascade=new Map();for(const domCascade of Array.from(this._pseudoDOMCascades.values()).concat(this._mainDOMCascade)){for(const style of domCascade.styles()){this._styleToDOMCascade.set(style,domCascade);}}
function cleanUserAgentPayload(payload){for(const ruleMatch of payload){cleanUserAgentSelectors(ruleMatch);}
const cleanMatchedPayload=[];for(const ruleMatch of payload){const lastMatch=cleanMatchedPayload.peekLast();if(!lastMatch||ruleMatch.rule.origin!=='user-agent'||lastMatch.rule.origin!=='user-agent'||ruleMatch.rule.selectorList.text!==lastMatch.rule.selectorList.text||mediaText(ruleMatch)!==mediaText(lastMatch)){cleanMatchedPayload.push(ruleMatch);continue;}
mergeRule(ruleMatch,lastMatch);}
return cleanMatchedPayload;function mergeRule(from,to){const shorthands=(new Map());const properties=(new Map());for(const entry of to.rule.style.shorthandEntries){shorthands.set(entry.name,entry.value);}
for(const entry of to.rule.style.cssProperties){properties.set(entry.name,entry.value);}
for(const entry of from.rule.style.shorthandEntries){shorthands.set(entry.name,entry.value);}
for(const entry of from.rule.style.cssProperties){properties.set(entry.name,entry.value);}
to.rule.style.shorthandEntries=shorthands.keysArray().map(name=>({name,value:shorthands.get(name)}));to.rule.style.cssProperties=properties.keysArray().map(name=>({name,value:properties.get(name)}));}
function mediaText(ruleMatch){if(!ruleMatch.rule.media){return null;}
return ruleMatch.rule.media.map(media=>media.text).join(', ');}
function cleanUserAgentSelectors(ruleMatch){const{matchingSelectors,rule}=ruleMatch;if(rule.origin!=='user-agent'||!matchingSelectors.length){return;}
rule.selectorList.selectors=rule.selectorList.selectors.filter((item,i)=>matchingSelectors.includes(i));rule.selectorList.text=rule.selectorList.selectors.map(item=>item.text).join(', ');ruleMatch.matchingSelectors=matchingSelectors.map((item,i)=>i);}}}
_buildMainCascade(inlinePayload,attributesPayload,matchedPayload,inheritedPayload){const nodeCascades=[];const nodeStyles=[];function addAttributesStyle(){if(!attributesPayload){return;}
const style=new SDK.CSSStyleDeclaration(this._cssModel,null,attributesPayload,SDK.CSSStyleDeclaration.Type.Attributes);this._nodeForStyle.set(style,this._node);nodeStyles.push(style);}
if(inlinePayload&&this._node.nodeType()===Node.ELEMENT_NODE){const style=new SDK.CSSStyleDeclaration(this._cssModel,null,inlinePayload,SDK.CSSStyleDeclaration.Type.Inline);this._nodeForStyle.set(style,this._node);nodeStyles.push(style);}
let addedAttributesStyle;for(let i=matchedPayload.length-1;i>=0;--i){const rule=new SDK.CSSStyleRule(this._cssModel,matchedPayload[i].rule);if((rule.isInjected()||rule.isUserAgent())&&!addedAttributesStyle){addedAttributesStyle=true;addAttributesStyle.call(this);}
this._nodeForStyle.set(rule.style,this._node);nodeStyles.push(rule.style);this._addMatchingSelectors(this._node,rule,matchedPayload[i].matchingSelectors);}
if(!addedAttributesStyle){addAttributesStyle.call(this);}
nodeCascades.push(new NodeCascade(this,nodeStyles,false));let parentNode=this._node.parentNode;for(let i=0;parentNode&&inheritedPayload&&i<inheritedPayload.length;++i){const inheritedStyles=[];const entryPayload=inheritedPayload[i];const inheritedInlineStyle=entryPayload.inlineStyle?new SDK.CSSStyleDeclaration(this._cssModel,null,entryPayload.inlineStyle,SDK.CSSStyleDeclaration.Type.Inline):null;if(inheritedInlineStyle&&this._containsInherited(inheritedInlineStyle)){this._nodeForStyle.set(inheritedInlineStyle,parentNode);inheritedStyles.push(inheritedInlineStyle);this._inheritedStyles.add(inheritedInlineStyle);}
const inheritedMatchedCSSRules=entryPayload.matchedCSSRules||[];for(let j=inheritedMatchedCSSRules.length-1;j>=0;--j){const inheritedRule=new SDK.CSSStyleRule(this._cssModel,inheritedMatchedCSSRules[j].rule);this._addMatchingSelectors(parentNode,inheritedRule,inheritedMatchedCSSRules[j].matchingSelectors);if(!this._containsInherited(inheritedRule.style)){continue;}
if(containsStyle(nodeStyles,inheritedRule.style)||containsStyle(this._inheritedStyles,inheritedRule.style)){continue;}
this._nodeForStyle.set(inheritedRule.style,parentNode);inheritedStyles.push(inheritedRule.style);this._inheritedStyles.add(inheritedRule.style);}
parentNode=parentNode.parentNode;nodeCascades.push(new NodeCascade(this,inheritedStyles,true));}
return new DOMInheritanceCascade(nodeCascades);function containsStyle(styles,query){if(!query.styleSheetId||!query.range){return false;}
for(const style of styles){if(query.styleSheetId===style.styleSheetId&&style.range&&query.range.equal(style.range)){return true;}}
return false;}}
_buildPseudoCascades(pseudoPayload){const pseudoCascades=new Map();if(!pseudoPayload){return pseudoCascades;}
for(let i=0;i<pseudoPayload.length;++i){const entryPayload=pseudoPayload[i];const pseudoElement=this._node.pseudoElements().get(entryPayload.pseudoType)||null;const pseudoStyles=[];const rules=entryPayload.matches||[];for(let j=rules.length-1;j>=0;--j){const pseudoRule=new SDK.CSSStyleRule(this._cssModel,rules[j].rule);pseudoStyles.push(pseudoRule.style);this._nodeForStyle.set(pseudoRule.style,pseudoElement);if(pseudoElement){this._addMatchingSelectors(pseudoElement,pseudoRule,rules[j].matchingSelectors);}}
const nodeCascade=new NodeCascade(this,pseudoStyles,false);pseudoCascades.set(entryPayload.pseudoType,new DOMInheritanceCascade([nodeCascade]));}
return pseudoCascades;}
_addMatchingSelectors(node,rule,matchingSelectorIndices){for(const matchingSelectorIndex of matchingSelectorIndices){const selector=rule.selectors[matchingSelectorIndex];this._setSelectorMatches(node,selector.text,true);}}
node(){return this._node;}
cssModel(){return this._cssModel;}
hasMatchingSelectors(rule){const matchingSelectors=this.matchingSelectors(rule);return matchingSelectors.length>0&&this.mediaMatches(rule.style);}
matchingSelectors(rule){const node=this.nodeForStyle(rule.style);if(!node){return[];}
const map=this._matchingSelectors.get(node.id);if(!map){return[];}
const result=[];for(let i=0;i<rule.selectors.length;++i){if(map.get(rule.selectors[i].text)){result.push(i);}}
return result;}
recomputeMatchingSelectors(rule){const node=this.nodeForStyle(rule.style);if(!node){return Promise.resolve();}
const promises=[];for(const selector of rule.selectors){promises.push(querySelector.call(this,node,selector.text));}
return Promise.all(promises);async function querySelector(node,selectorText){const ownerDocument=node.ownerDocument||null;const map=this._matchingSelectors.get(node.id);if((map&&map.has(selectorText))||!ownerDocument){return;}
const matchingNodeIds=await this._node.domModel().querySelectorAll(ownerDocument.id,selectorText);if(matchingNodeIds){this._setSelectorMatches(node,selectorText,matchingNodeIds.indexOf(node.id)!==-1);}}}
addNewRule(rule,node){this._addedStyles.set(rule.style,node);return this.recomputeMatchingSelectors(rule);}
_setSelectorMatches(node,selectorText,value){let map=this._matchingSelectors.get(node.id);if(!map){map=new Map();this._matchingSelectors.set(node.id,map);}
map.set(selectorText,value);}
mediaMatches(style){const media=style.parentRule?style.parentRule.media:[];for(let i=0;media&&i<media.length;++i){if(!media[i].active()){return false;}}
return true;}
nodeStyles(){return this._mainDOMCascade.styles();}
keyframes(){return this._keyframes;}
pseudoStyles(pseudoType){const domCascade=this._pseudoDOMCascades.get(pseudoType);return domCascade?domCascade.styles():[];}
pseudoTypes(){return new Set(this._pseudoDOMCascades.keys());}
_containsInherited(style){const properties=style.allProperties();for(let i=0;i<properties.length;++i){const property=properties[i];if(property.activeInStyle()&&SDK.cssMetadata().isPropertyInherited(property.name)){return true;}}
return false;}
nodeForStyle(style){return this._addedStyles.get(style)||this._nodeForStyle.get(style)||null;}
availableCSSVariables(style){const domCascade=this._styleToDOMCascade.get(style)||null;return domCascade?domCascade.availableCSSVariables(style):[];}
computeCSSVariable(style,variableName){const domCascade=this._styleToDOMCascade.get(style)||null;return domCascade?domCascade.computeCSSVariable(style,variableName):null;}
computeValue(style,value){const domCascade=this._styleToDOMCascade.get(style)||null;return domCascade?domCascade.computeValue(style,value):null;}
isInherited(style){return this._inheritedStyles.has(style);}
propertyState(property){const domCascade=this._styleToDOMCascade.get(property.ownerStyle);return domCascade?domCascade.propertyState(property):null;}
resetActiveProperties(){this._mainDOMCascade.reset();for(const domCascade of this._pseudoDOMCascades.values()){domCascade.reset();}}}
export class NodeCascade{constructor(matchedStyles,styles,isInherited){this._matchedStyles=matchedStyles;this._styles=styles;this._isInherited=isInherited;this._propertiesState=new Map();this._activeProperties=new Map();}
_computeActiveProperties(){this._propertiesState.clear();this._activeProperties.clear();for(const style of this._styles){const rule=style.parentRule;if(rule&&!(rule instanceof SDK.CSSStyleRule)){continue;}
if(rule&&!this._matchedStyles.hasMatchingSelectors(rule)){continue;}
for(const property of style.allProperties()){if(this._isInherited&&!SDK.cssMetadata().isPropertyInherited(property.name)){continue;}
if(!property.activeInStyle()){this._propertiesState.set(property,PropertyState.Overloaded);continue;}
const canonicalName=SDK.cssMetadata().canonicalPropertyName(property.name);const activeProperty=this._activeProperties.get(canonicalName);if(activeProperty&&(activeProperty.important||!property.important)){this._propertiesState.set(property,PropertyState.Overloaded);continue;}
if(activeProperty){this._propertiesState.set(activeProperty,PropertyState.Overloaded);}
this._propertiesState.set(property,PropertyState.Active);this._activeProperties.set(canonicalName,property);}}}}
export class DOMInheritanceCascade{constructor(nodeCascades){this._nodeCascades=nodeCascades;this._propertiesState=new Map();this._availableCSSVariables=new Map();this._computedCSSVariables=new Map();this._initialized=false;this._styleToNodeCascade=new Map();for(const nodeCascade of nodeCascades){for(const style of nodeCascade._styles){this._styleToNodeCascade.set(style,nodeCascade);}}}
availableCSSVariables(style){const nodeCascade=this._styleToNodeCascade.get(style);if(!nodeCascade){return[];}
this._ensureInitialized();return Array.from(this._availableCSSVariables.get(nodeCascade).keys());}
computeCSSVariable(style,variableName){const nodeCascade=this._styleToNodeCascade.get(style);if(!nodeCascade){return null;}
this._ensureInitialized();const availableCSSVariables=this._availableCSSVariables.get(nodeCascade);const computedCSSVariables=this._computedCSSVariables.get(nodeCascade);return this._innerComputeCSSVariable(availableCSSVariables,computedCSSVariables,variableName);}
computeValue(style,value){const nodeCascade=this._styleToNodeCascade.get(style);if(!nodeCascade){return null;}
this._ensureInitialized();const availableCSSVariables=this._availableCSSVariables.get(nodeCascade);const computedCSSVariables=this._computedCSSVariables.get(nodeCascade);return this._innerComputeValue(availableCSSVariables,computedCSSVariables,value);}
_innerComputeCSSVariable(availableCSSVariables,computedCSSVariables,variableName){if(!availableCSSVariables.has(variableName)){return null;}
if(computedCSSVariables.has(variableName)){return computedCSSVariables.get(variableName);}
computedCSSVariables.set(variableName,null);const definedValue=availableCSSVariables.get(variableName);const computedValue=this._innerComputeValue(availableCSSVariables,computedCSSVariables,definedValue);computedCSSVariables.set(variableName,computedValue);return computedValue;}
_innerComputeValue(availableCSSVariables,computedCSSVariables,value){const results=TextUtils.TextUtils.splitStringByRegexes(value,[SDK.CSSMetadata.VariableRegex]);const tokens=[];for(const result of results){if(result.regexIndex===-1){tokens.push(result.value);continue;}
const regexMatch=result.value.match(/^var\((--[a-zA-Z0-9-_]+)[,]?\s*(.*)\)$/);if(!regexMatch){return null;}
const cssVariable=regexMatch[1];const computedValue=this._innerComputeCSSVariable(availableCSSVariables,computedCSSVariables,cssVariable);if(computedValue===null&&!regexMatch[2]){return null;}
if(computedValue===null){tokens.push(regexMatch[2]);}else{tokens.push(computedValue);}}
return tokens.map(token=>token.trim()).join(' ');}
styles(){return Array.from(this._styleToNodeCascade.keys());}
propertyState(property){this._ensureInitialized();return this._propertiesState.get(property)||null;}
reset(){this._initialized=false;this._propertiesState.clear();this._availableCSSVariables.clear();this._computedCSSVariables.clear();}
_ensureInitialized(){if(this._initialized){return;}
this._initialized=true;const activeProperties=new Map();for(const nodeCascade of this._nodeCascades){nodeCascade._computeActiveProperties();for(const entry of nodeCascade._propertiesState.entries()){const property=(entry[0]);const state=(entry[1]);if(state===PropertyState.Overloaded){this._propertiesState.set(property,PropertyState.Overloaded);continue;}
const canonicalName=SDK.cssMetadata().canonicalPropertyName(property.name);if(activeProperties.has(canonicalName)){this._propertiesState.set(property,PropertyState.Overloaded);continue;}
activeProperties.set(canonicalName,property);this._propertiesState.set(property,PropertyState.Active);}}
for(const entry of activeProperties.entries()){const canonicalName=(entry[0]);const shorthandProperty=(entry[1]);const shorthandStyle=shorthandProperty.ownerStyle;const longhands=shorthandStyle.longhandProperties(shorthandProperty.name);if(!longhands.length){continue;}
let hasActiveLonghands=false;for(const longhand of longhands){const longhandCanonicalName=SDK.cssMetadata().canonicalPropertyName(longhand.name);const longhandActiveProperty=activeProperties.get(longhandCanonicalName);if(!longhandActiveProperty){continue;}
if(longhandActiveProperty.ownerStyle===shorthandStyle){hasActiveLonghands=true;break;}}
if(hasActiveLonghands){continue;}
activeProperties.delete(canonicalName);this._propertiesState.set(shorthandProperty,PropertyState.Overloaded);}
const accumulatedCSSVariables=new Map();for(let i=this._nodeCascades.length-1;i>=0;--i){const nodeCascade=this._nodeCascades[i];for(const entry of nodeCascade._activeProperties.entries()){const propertyName=(entry[0]);const property=(entry[1]);if(propertyName.startsWith('--')){accumulatedCSSVariables.set(propertyName,property.value);}}
this._availableCSSVariables.set(nodeCascade,new Map(accumulatedCSSVariables));this._computedCSSVariables.set(nodeCascade,new Map());}}}
export const PropertyState={Active:'Active',Overloaded:'Overloaded'};self.SDK=self.SDK||{};SDK=SDK||{};SDK.CSSMatchedStyles=CSSMatchedStyles;SDK.CSSMatchedStyles.NodeCascade=NodeCascade;SDK.CSSMatchedStyles.DOMInheritanceCascade=DOMInheritanceCascade;SDK.CSSMatchedStyles.PropertyState=PropertyState;