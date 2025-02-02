CssOverview.OverviewController=class extends Common.Object{constructor(){super();SDK.targetManager.addEventListener(SDK.TargetManager.Events.InspectedURLChanged,this._reset,this);}
_reset(){this.dispatchEventToListeners(CssOverview.Events.Reset);}};CssOverview.Events={RequestOverviewStart:Symbol('RequestOverviewStart'),RequestOverviewCancel:Symbol('RequestOverviewCancel'),OverviewCompleted:Symbol('OverviewCompleted'),Reset:Symbol('Reset'),};;CssOverview.CSSOverviewModel=class extends SDK.SDKModel{constructor(target){super(target);this._runtimeAgent=target.runtimeAgent();this._cssAgent=target.cssAgent();this._domAgent=target.domAgent();}
getFlattenedDocument(){return this._domAgent.getFlattenedDocument(-1,true);}
getComputedStyleForNode(nodeId){return this._cssAgent.getComputedStyleForNode(nodeId);}
async getMediaQueries(){const queries=await this._cssAgent.getMediaQueries();return queries.filter(query=>query.source!=='linkedSheet');}
async getGlobalStylesheetStats(){const expression=`(function() {
      let styleRules = 0;
      let inlineStyles = 0;
      let externalSheets = 0;
      for (const { rules, href } of document.styleSheets) {
        if (href) {
          externalSheets++;
        } else {
          inlineStyles++;
        }

        for (const rule of rules) {
          if ('selectorText' in rule) {
            styleRules++;
          }
        }
      }

      return {
        styleRules,
        inlineStyles,
        externalSheets
      }
    })()`;const{result}=await this._runtimeAgent.invoke_evaluate({expression,returnByValue:true});if(result.type!=='object'){return;}
return result.value;}
async getStylesStatsForNode(nodeId){const stats={type:new Set(),class:new Set(),id:new Set(),universal:new Set(),attribute:new Set(),nonSimple:new Set()};const matches=await this._cssAgent.invoke_getMatchedStylesForNode({nodeId});if(!matches||!matches.matchedCSSRules||!matches.matchedCSSRules.length){return;}
matches.matchedCSSRules.forEach(cssRule=>{const{matchingSelectors}=cssRule;const{origin,selectorList}=cssRule.rule;const isExternalSheet=origin==='regular';if(!isExternalSheet||!selectorList){return;}
const selectors=matchingSelectors.map(idx=>selectorList.selectors[idx]);for(const{text}of selectors){for(const selectorGroup of text.split(',')){for(const selector of selectorGroup.split(/[\t\n\f\r ]+/g)){if(selector.startsWith('.')){stats.class.add(selector);}else if(selector.startsWith('#')){stats.id.add(selector);}else if(selector.startsWith('*')){stats.universal.add(selector);}else if(selector.startsWith('[')){stats.attribute.add(selector);}else{const specialChars=/[#\.:\[\]|\+>~]/;if(specialChars.test(selector)){stats.nonSimple.add(selector);}else{stats.type.add(selector);}}}}}});return stats;}};SDK.SDKModel.register(CssOverview.CSSOverviewModel,SDK.Target.Capability.DOM,false);;CssOverview.CSSOverviewStartView=class extends UI.Widget{constructor(controller){super();this.registerRequiredCSS('css_overview/cssOverviewStartView.css');this._controller=controller;this._render();}
_render(){const startButton=UI.createTextButton(ls`Capture overview`,()=>this._controller.dispatchEventToListeners(CssOverview.Events.RequestOverviewStart),'',true);this.setDefaultFocusedElement(startButton);const fragment=UI.Fragment.build`
      <div class="vbox overview-start-view">
        <h1>${ls`CSS Overview`}</h1>
        <div>${startButton}</div>
      </div>
    `;this.contentElement.appendChild(fragment.element());this.contentElement.style.overflow='auto';}};;CssOverview.CSSOverviewProcessingView=class extends UI.Widget{constructor(controller){super();this.registerRequiredCSS('css_overview/cssOverviewProcessingView.css');this._formatter=new Intl.NumberFormat('en-US');this._controller=controller;this._render();}
_render(){const cancelButton=UI.createTextButton(ls`Cancel`,()=>this._controller.dispatchEventToListeners(CssOverview.Events.RequestOverviewCancel),'',true);this.setDefaultFocusedElement(cancelButton);this.fragment=UI.Fragment.build`
      <div class="vbox overview-processing-view">
        <h1>Processing page</h1>
        <div>${cancelButton}</div>

        <h2 $="processed"></h2>
      </div>
    `;this.contentElement.appendChild(this.fragment.element());this.contentElement.style.overflow='auto';}
setElementsHandled(handled=0,total=0){const elementsTotal=total>0?ls`document elements`:ls`document element`;this.fragment.$('processed').textContent=ls`Processed ${this._formatter.format(handled)} of ${this._formatter.format(total)} ${elementsTotal}.`;}};;CssOverview.CSSOverviewCompletedView=class extends UI.PanelWithSidebar{constructor(controller,target){super('css_overview_completed_view');this.registerRequiredCSS('css_overview/cssOverviewCompletedView.css');this._controller=controller;this._formatter=new Intl.NumberFormat('en-US');this._mainContainer=new UI.VBox();this._sideBar=new CssOverview.CSSOverviewSidebarPanel();this.splitWidget().setSidebarWidget(this._sideBar);this.splitWidget().setMainWidget(this._mainContainer);this._cssModel=target.model(SDK.CSSModel);this._linkifier=new Components.Linkifier(20,true);this._columns=[{id:'text',title:ls`Text`,visible:true,sortable:true,weight:60},{id:'sourceURL',title:ls`Source`,visible:true,sortable:true,weight:40}];this._mediaQueryGrid=new DataGrid.SortableDataGrid(this._columns);this._mediaQueryGrid.element.classList.add('media-query-grid');this._mediaQueryGrid.setStriped(true);this._mediaQueryGrid.addEventListener(DataGrid.DataGrid.Events.SortingChanged,this._sortMediaQueryDataGrid.bind(this));this._sideBar.addItem(ls`Overview summary`,'summary');this._sideBar.addItem(ls`Colors`,'colors');this._sideBar.addItem(ls`Media queries`,'media-queries');this._sideBar.select('summary');this._sideBar.addEventListener(CssOverview.SidebarEvents.ItemSelected,this._sideBarItemSelected,this);this._sideBar.addEventListener(CssOverview.SidebarEvents.Reset,this._sideBarReset,this);this._controller.addEventListener(CssOverview.Events.Reset,this._reset,this);this._render({});}
_sortMediaQueryDataGrid(){const sortColumnId=this._mediaQueryGrid.sortColumnId();if(!sortColumnId){return;}
const comparator=DataGrid.SortableDataGrid.StringComparator.bind(null,sortColumnId);this._mediaQueryGrid.sortNodes(comparator,!this._mediaQueryGrid.isSortOrderAscending());}
_sideBarItemSelected(event){const section=this._fragment.$(event.data);if(!section){return;}
section.scrollIntoView();}
_sideBarReset(){this._controller.dispatchEventToListeners(CssOverview.Events.Reset);}
_reset(){this._mainContainer.element.removeChildren();this._mediaQueryGrid.rootNode().removeChildren();}
_render(data){if(!(data&&('textColors'in data)&&('backgroundColors'in data))){return;}
const{elementStyleStats,elementCount,backgroundColors,textColors,globalStyleStats,mediaQueries}=data;const nonTransparentBackgroundColors=this._getNonTransparentColorStrings(backgroundColors);const nonTransparentTextColors=this._getNonTransparentColorStrings(textColors);this._fragment=UI.Fragment.build`
    <div class="vbox overview-completed-view">
      <div $="summary" class="results-section summary">
        <h1>${ls`Overview summary`}</h1>

        <ul>
          <li>
            <div class="label">${ls`Elements processed`}</div>
            <div class="value">${this._formatter.format(elementCount)}</div>
          </li>
          <li>
            <div class="label">${ls`External stylesheets`}</div>
            <div class="value">${this._formatter.format(globalStyleStats.externalSheets)}</div>
          </li>
          <li>
            <div class="label">${ls`Inline style elements`}</div>
            <div class="value">${this._formatter.format(globalStyleStats.inlineStyles)}</div>
          </li>
          <li>
            <div class="label">${ls`Style rules`}</div>
            <div class="value">${this._formatter.format(globalStyleStats.styleRules)}</div>
          </li>
          <li>
            <div class="label">${ls`Media queries`}</div>
            <div class="value">${this._formatter.format(mediaQueries.length)}</div>
          </li>
          <li>
            <div class="label">${ls`Type selectors`}</div>
            <div class="value">${this._formatter.format(elementStyleStats.type.size)}</div>
          </li>
          <li>
            <div class="label">${ls`ID selectors`}</div>
            <div class="value">${this._formatter.format(elementStyleStats.id.size)}</div>
          </li>
          <li>
            <div class="label">${ls`Class selectors`}</div>
            <div class="value">${this._formatter.format(elementStyleStats.class.size)}</div>
          </li>
          <li>
            <div class="label">${ls`Universal selectors`}</div>
            <div class="value">${this._formatter.format(elementStyleStats.universal.size)}</div>
          </li>
          <li>
            <div class="label">${ls`Attribute selectors`}</div>
            <div class="value">${this._formatter.format(elementStyleStats.attribute.size)}</div>
          </li>
          <li>
            <div class="label">${ls`Non-simple selectors`}</div>
            <div class="value">${this._formatter.format(elementStyleStats.nonSimple.size)}</div>
          </li>
        </ul>
      </div>

      <div $="colors" class="results-section colors">
        <h1>${ls`Colors`}</h1>
        <h2>${ls`Unique background colors:${nonTransparentBackgroundColors.length}`}</h2>
        <ul>
          ${nonTransparentBackgroundColors.map(this._colorsToFragment)}
        </ul>

        <h2>${ls`Unique text colors:${nonTransparentTextColors.length}`}</h2>
        <ul>
          ${nonTransparentTextColors.map(this._colorsToFragment)}
        </ul>
      </div>

      <div $="media-queries" class="results-section media-queries">
        <h1>${ls`Media queries`}</h1>
        ${this._mediaQueryGrid.element}
      </div>
    </div>`;for(const mediaQuery of mediaQueries){const mediaQueryNode=new CssOverview.CSSOverviewCompletedView.MediaQueryNode(this._mediaQueryGrid,mediaQuery,this._cssModel,this._linkifier);mediaQueryNode.selectable=false;this._mediaQueryGrid.insertChild(mediaQueryNode);}
this._mainContainer.element.appendChild(this._fragment.element());this._mediaQueryGrid.renderInline();this._mediaQueryGrid.wasShown();}
_colorsToFragment(color){const colorFormatted=color.hasAlpha()?color.asString(Common.Color.Format.HEXA):color.asString(Common.Color.Format.HEX);const blockFragment=UI.Fragment.build`<li>
      <div class="block" $="color"></div>
      <div class="block-title">${colorFormatted}</div>
    </li>`;const block=blockFragment.$('color');block.style.backgroundColor=colorFormatted;let[h,s,l]=color.hsla();h=Math.round(h*360);s=Math.round(s*100);l=Math.round(l*100);l=Math.max(0,l-15);const borderString=`1px solid hsl(${h}, ${s}%, ${l}%)`;block.style.border=borderString;return blockFragment;}
_getNonTransparentColorStrings(srcColors){const colors=[];for(const colorText of Array.from(srcColors)){const color=Common.Color.parse(colorText);if(color.rgba()[3]===0){continue;}
colors.push(color);}
return colors.sort((colorA,colorB)=>{return Common.Color.luminance(colorB.rgba())-Common.Color.luminance(colorA.rgba());});}
setOverviewData(data){this._render(data);}};CssOverview.CSSOverviewCompletedView.MediaQueryNode=class extends DataGrid.SortableDataGridNode{constructor(dataGrid,mediaQueryData,cssModel,linkifier){super(dataGrid,mediaQueryData.hasChildren);this.data=mediaQueryData;this._cssModel=cssModel;this._linkifier=linkifier;}
createCell(columnId){if(this.data.range&&columnId==='sourceURL'){const cell=this.createTD(columnId);const link=this._linkifyRuleLocation(this._cssModel,this._linkifier,this.data.styleSheetId,TextUtils.TextRange.fromObject(this.data.range));if(link.textContent!==''){cell.appendChild(link);}else{cell.textContent=`${this.data.sourceURL} (not available)`;}
return cell;}
return super.createCell(columnId);}
_linkifyRuleLocation(cssModel,linkifier,styleSheetId,ruleLocation){const styleSheetHeader=cssModel.styleSheetHeaderForId(styleSheetId);const lineNumber=styleSheetHeader.lineNumberInSource(ruleLocation.startLine);const columnNumber=styleSheetHeader.columnNumberInSource(ruleLocation.startLine,ruleLocation.startColumn);const matchingSelectorLocation=new SDK.CSSLocation(styleSheetHeader,lineNumber,columnNumber);return linkifier.linkifyCSSLocation(matchingSelectorLocation);}};;CssOverview.CSSOverviewSidebarPanel=class extends UI.VBox{static get ITEM_CLASS_NAME(){return'overview-sidebar-panel-item';}
static get SELECTED(){return'selected';}
constructor(){super(true);this.registerRequiredCSS('css_overview/cssOverviewSidebarPanel.css');this.contentElement.classList.add('overview-sidebar-panel');this.contentElement.addEventListener('click',this._onItemClick.bind(this));const clearResultsButton=new UI.ToolbarButton(ls`Clear overview`,'largeicon-clear');clearResultsButton.addEventListener(UI.ToolbarButton.Events.Click,this._reset,this);const toolbarElement=this.contentElement.createChild('div','overview-toolbar');const toolbar=new UI.Toolbar('',toolbarElement);toolbar.appendToolbarItem(clearResultsButton);}
addItem(name,id){const item=this.contentElement.createChild('div',CssOverview.CSSOverviewSidebarPanel.ITEM_CLASS_NAME);item.textContent=name;item.dataset.id=id;}
_reset(){this.dispatchEventToListeners(CssOverview.SidebarEvents.Reset);}
_deselectAllItems(){const items=this.contentElement.querySelectorAll(`.${CssOverview.CSSOverviewSidebarPanel.ITEM_CLASS_NAME}`);for(const item of items){item.classList.remove(CssOverview.CSSOverviewSidebarPanel.SELECTED);}}
_onItemClick(event){const target=event.path[0];if(!target.classList.contains(CssOverview.CSSOverviewSidebarPanel.ITEM_CLASS_NAME)){return;}
const{id}=target.dataset;this.select(id);this.dispatchEventToListeners(CssOverview.SidebarEvents.ItemSelected,id);}
select(id){const target=this.contentElement.querySelector(`[data-id=${CSS.escape(id)}]`);if(!target){return;}
if(target.classList.contains(CssOverview.CSSOverviewSidebarPanel.SELECTED)){return;}
this._deselectAllItems();target.classList.add(CssOverview.CSSOverviewSidebarPanel.SELECTED);}};CssOverview.SidebarEvents={ItemSelected:Symbol('ItemSelected'),Reset:Symbol('Reset')};;CssOverview.CSSOverviewPanel=class extends UI.Panel{constructor(){super('css_overview');this.registerRequiredCSS('css_overview/cssOverview.css');this.element.classList.add('css-overview-panel');const[model]=SDK.targetManager.models(CssOverview.CSSOverviewModel);this._model=model;this._controller=new CssOverview.OverviewController();this._startView=new CssOverview.CSSOverviewStartView(this._controller);this._processingView=new CssOverview.CSSOverviewProcessingView(this._controller);this._completedView=new CssOverview.CSSOverviewCompletedView(this._controller,model.target());this._controller.addEventListener(CssOverview.Events.RequestOverviewStart,this._startOverview,this);this._controller.addEventListener(CssOverview.Events.RequestOverviewCancel,this._cancelOverview,this);this._controller.addEventListener(CssOverview.Events.OverviewCompleted,this._overviewCompleted,this);this._controller.addEventListener(CssOverview.Events.Reset,this._reset,this);this._reset();}
_reset(){this._backgroundColors=new Set();this._textColors=new Set();this._fontSizes=new Map();this._mediaQueries=[];this._elementCount=0;this._elementStyleStats={type:new Set(),class:new Set(),id:new Set(),universal:new Set(),attribute:new Set(),nonSimple:new Set()};this._cancelled=false;this._globalStyleStats={styleRules:0,inlineStyles:0,externalSheets:0};this._renderInitialView();}
_renderInitialView(){this._processingView.hideWidget();this._completedView.hideWidget();this._startView.show(this.contentElement);}
_renderOverviewStartedView(elementsHandled=0,total=0){this._startView.hideWidget();this._completedView.hideWidget();this._processingView.show(this.contentElement);this._processingView.setElementsHandled(elementsHandled,total);}
_renderOverviewCompletedView(){this._startView.hideWidget();this._processingView.hideWidget();this._completedView.show(this.contentElement);this._completedView.setOverviewData({backgroundColors:this._backgroundColors,textColors:this._textColors,globalStyleStats:this._globalStyleStats,elementStyleStats:this._elementStyleStats,fontSizes:this._fontSizes,elementCount:this._elementCount,mediaQueries:this._mediaQueries});}
async _startOverview(){this._renderOverviewStartedView();const document=await this._model.getFlattenedDocument();if(this._cancelled){this._reset();return;}
const globalStyleStats=await this._model.getGlobalStylesheetStats();if(globalStyleStats){this._globalStyleStats=globalStyleStats;}
const mediaQueries=await this._model.getMediaQueries();if(mediaQueries){this._mediaQueries=mediaQueries;}
this._elementCount=document.length;for(let idx=0;idx<document.length;idx++){if(this._cancelled){this._reset();return;}
const node=document[idx];const[computedStyles,styleStats]=await Promise.all([this._model.getComputedStyleForNode(node.nodeId),this._model.getStylesStatsForNode(node.nodeId)]);if(computedStyles){const backgroundColor=this._getStyleValue(computedStyles,'background-color');if(backgroundColor){this._backgroundColors.add(backgroundColor);}
if(node.nodeType===Node.TEXT_NODE){const textColor=this._getStyleValue(computedStyles,'color');this._textColors.add(textColor);const fontSize=this._getStyleValue(computedStyles,'font-size');if(!this._fontSizes.has(fontSize)){this._fontSizes.set(fontSize,0);}
this._fontSizes.set(fontSize,this._fontSizes.get(fontSize)+1);}}
if(styleStats){for(const section of Object.keys(this._elementStyleStats)){if(!styleStats[section]){continue;}
for(const value of styleStats[section]){this._elementStyleStats[section].add(value);}}}
this._renderOverviewStartedView(idx+1,document.length);}
this._controller.dispatchEventToListeners(CssOverview.Events.OverviewCompleted);}
_getStyleValue(styles,name){const item=styles.filter(style=>style.name===name);if(!item.length){return;}
return item[0].value;}
_cancelOverview(){this._cancelled=true;}
_overviewCompleted(){this._renderOverviewCompletedView();}};;Root.Runtime.cachedResources["css_overview/cssOverview.css"]="/**\n * Copyright 2019 The Chromium Authors. All rights reserved.\n * Use of this source code is governed by a BSD-style license that can be\n * found in the LICENSE file.\n */\n\n.css-overview-panel {\n  overflow: hidden;\n}\n\n/*# sourceURL=css_overview/cssOverview.css */";Root.Runtime.cachedResources["css_overview/cssOverviewStartView.css"]="/**\n * Copyright 2019 The Chromium Authors. All rights reserved.\n * Use of this source code is governed by a BSD-style license that can be\n * found in the LICENSE file.\n */\n\n.overview-start-view {\n  overflow: hidden;\n  padding: 16px;\n  justify-content: center;\n  align-items: center;\n  height: 100%;\n}\n\n.overview-start-view h1 {\n  font-size: 16px;\n  text-align: center;\n  font-weight: normal;\n  margin: 0;\n  padding: 8px;\n}\n\n.overview-start-view div {\n  font-size: 12px;\n  text-align: center;\n  font-weight: normal;\n  margin: 0;\n  padding-bottom: 44px;\n}\n\n/*# sourceURL=css_overview/cssOverviewStartView.css */";Root.Runtime.cachedResources["css_overview/cssOverviewProcessingView.css"]="/**\n * Copyright 2019 The Chromium Authors. All rights reserved.\n * Use of this source code is governed by a BSD-style license that can be\n * found in the LICENSE file.\n */\n\n.overview-processing-view {\n  overflow: hidden;\n}\n\n.overview-processing-view {\n  overflow: hidden;\n  padding: 16px;\n  justify-content: center;\n  align-items: center;\n  height: 100%;\n}\n\n.overview-processing-view h1 {\n  font-size: 16px;\n  text-align: center;\n  font-weight: normal;\n  margin: 0;\n  padding: 8px;\n}\n\n.overview-processing-view h2 {\n  font-size: 12px;\n  text-align: center;\n  font-weight: normal;\n  margin: 0;\n  padding-top: 32px;\n}\n\n/*# sourceURL=css_overview/cssOverviewProcessingView.css */";Root.Runtime.cachedResources["css_overview/cssOverviewCompletedView.css"]="/**\n * Copyright 2019 The Chromium Authors. All rights reserved.\n * Use of this source code is governed by a BSD-style license that can be\n * found in the LICENSE file.\n */\n\n.overview-completed-view {\n  overflow: auto;\n}\n\n.overview-completed-view .summary ul,\n.overview-completed-view .colors ul {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n}\n\n.overview-completed-view .summary ul {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, 140px);\n  grid-gap: 16px;\n}\n\n.overview-completed-view .colors ul li {\n  display: inline-block;\n  padding: 0;\n  margin: 0 0 16px 0;\n}\n\n.overview-completed-view .summary ul li {\n  display: flex;\n  flex-direction: column;\n  grid-column-start: auto;\n}\n\n.overview-completed-view li .label {\n  font-size: 12px;\n  padding-bottom: 2px;\n}\n\n.overview-completed-view li .value {\n  font-size: 17px;\n}\n\n.overview-completed-view ul li span {\n  font-weight: bold;\n}\n\n.media-query-grid .header-container,\n.media-query-grid .data-container,\n.media-query-grid table.data {\n  position: relative;\n}\n\n.media-query-grid .data-container {\n  top: 0;\n  max-height: 400px;\n}\n\n.block {\n  width: 65px;\n  height: 25px;\n  border-radius: 3px;\n  margin-right: 16px;\n}\n\n.block-title {\n  padding-top: 4px;\n  font-size: 12px;\n  color: #303942;\n  text-transform: uppercase;\n  letter-spacing: 0;\n}\n\n.results-section {\n  flex-shrink: 0;\n  padding: 28px;\n  border-bottom: 1px solid #E6E6E6;\n}\n\n.results-section h1 {\n  font-size: 15px;\n  font-weight: normal;\n  padding: 0;\n  margin: 0 0 20px 0;\n}\n\n.results-section.colors h2 {\n  margin-top: 20px;\n  font-size: 13px;\n  font-weight: normal;\n}\n\n/*# sourceURL=css_overview/cssOverviewCompletedView.css */";Root.Runtime.cachedResources["css_overview/cssOverviewSidebarPanel.css"]="/**\n * Copyright 2019 The Chromium Authors. All rights reserved.\n * Use of this source code is governed by a BSD-style license that can be\n * found in the LICENSE file.\n */\n\n.overview-sidebar-panel {\n  overflow: auto;\n  display: flex;\n  background: #F3F3F3;\n}\n\n.overview-sidebar-panel-item {\n  height: 30px;\n  padding-left: 30px;\n  display: flex;\n  align-items: center;\n  cursor: pointer;\n}\n\n.overview-sidebar-panel-item:hover,\n.overview-sidebar-panel-item:focus {\n  background: rgb(234, 234, 234);\n}\n\n.overview-sidebar-panel-item.selected {\n  background: #1A73E8;\n  color: #FFFFFF;\n}\n\n.overview-toolbar {\n  border-bottom: 1px solid rgb(204, 204, 204);\n}\n\n/*# sourceURL=css_overview/cssOverviewSidebarPanel.css */";