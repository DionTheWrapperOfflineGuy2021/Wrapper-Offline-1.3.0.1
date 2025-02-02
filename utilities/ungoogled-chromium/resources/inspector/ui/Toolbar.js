export default class Toolbar{constructor(className,parentElement){this._items=[];this.element=parentElement?parentElement.createChild('div'):createElement('div');this.element.className=className;this.element.classList.add('toolbar');this._enabled=true;this._shadowRoot=UI.createShadowRootWithCoreStyles(this.element,'ui/toolbar.css');this._contentElement=this._shadowRoot.createChild('div','toolbar-shadow');this._insertionPoint=this._contentElement.createChild('slot');}
static createLongPressActionButton(action,toggledOptions,untoggledOptions){const button=UI.Toolbar.createActionButton(action);const mainButtonClone=UI.Toolbar.createActionButton(action);let longClickController=null;let longClickButtons=null;let longClickGlyph=null;action.addEventListener(UI.Action.Events.Toggled,updateOptions);updateOptions();return button;function updateOptions(){const buttons=action.toggled()?(toggledOptions||null):(untoggledOptions||null);if(buttons&&buttons.length){if(!longClickController){longClickController=new UI.LongClickController(button.element,showOptions);longClickGlyph=UI.Icon.create('largeicon-longclick-triangle','long-click-glyph');button.element.appendChild(longClickGlyph);longClickButtons=buttons;}}else{if(longClickController){longClickController.dispose();longClickController=null;longClickGlyph.remove();longClickGlyph=null;longClickButtons=null;}}}
function showOptions(){let buttons=longClickButtons.slice();buttons.push(mainButtonClone);const document=button.element.ownerDocument;document.documentElement.addEventListener('mouseup',mouseUp,false);const optionsGlassPane=new UI.GlassPane();optionsGlassPane.setPointerEventsBehavior(UI.GlassPane.PointerEventsBehavior.BlockedByGlassPane);optionsGlassPane.show(document);const optionsBar=new UI.Toolbar('fill',optionsGlassPane.contentElement);optionsBar._contentElement.classList.add('floating');const buttonHeight=26;const hostButtonPosition=button.element.boxInWindow().relativeToElement(UI.GlassPane.container(document));const topNotBottom=hostButtonPosition.y+buttonHeight*buttons.length<document.documentElement.offsetHeight;if(topNotBottom){buttons=buttons.reverse();}
optionsBar.element.style.height=(buttonHeight*buttons.length)+'px';if(topNotBottom){optionsBar.element.style.top=(hostButtonPosition.y-5)+'px';}else{optionsBar.element.style.top=(hostButtonPosition.y-(buttonHeight*(buttons.length-1))-6)+'px';}
optionsBar.element.style.left=(hostButtonPosition.x-5)+'px';for(let i=0;i<buttons.length;++i){buttons[i].element.addEventListener('mousemove',mouseOver,false);buttons[i].element.addEventListener('mouseout',mouseOut,false);optionsBar.appendToolbarItem(buttons[i]);}
const hostButtonIndex=topNotBottom?0:buttons.length-1;buttons[hostButtonIndex].element.classList.add('emulate-active');function mouseOver(e){if(e.which!==1){return;}
const buttonElement=e.target.enclosingNodeOrSelfWithClass('toolbar-item');buttonElement.classList.add('emulate-active');}
function mouseOut(e){if(e.which!==1){return;}
const buttonElement=e.target.enclosingNodeOrSelfWithClass('toolbar-item');buttonElement.classList.remove('emulate-active');}
function mouseUp(e){if(e.which!==1){return;}
optionsGlassPane.hide();document.documentElement.removeEventListener('mouseup',mouseUp,false);for(let i=0;i<buttons.length;++i){if(buttons[i].element.classList.contains('emulate-active')){buttons[i].element.classList.remove('emulate-active');buttons[i]._clicked(e);break;}}}}}
static createActionButton(action,showLabel){const button=action.toggleable()?makeToggle():makeButton();if(showLabel){button.setText(action.title());}
button.addEventListener(ToolbarButton.Events.Click,action.execute,action);action.addEventListener(UI.Action.Events.Enabled,enabledChanged);button.setEnabled(action.enabled());return button;function makeButton(){const button=new ToolbarButton(action.title(),action.icon());if(action.title()){UI.Tooltip.install(button.element,action.title(),action.id());}
return button;}
function makeToggle(){const toggleButton=new ToolbarToggle(action.title(),action.icon(),action.toggledIcon());toggleButton.setToggleWithRedColor(action.toggleWithRedColor());action.addEventListener(UI.Action.Events.Toggled,toggled);toggled();return toggleButton;function toggled(){toggleButton.setToggled(action.toggled());if(action.title()){UI.Tooltip.install(toggleButton.element,action.title(),action.id());}}}
function enabledChanged(event){button.setEnabled((event.data));}}
static createActionButtonForId(actionId,showLabel){const action=UI.actionRegistry.action(actionId);return UI.Toolbar.createActionButton((action),showLabel);}
gripElementForResize(){return this._contentElement;}
makeWrappable(growVertically){this._contentElement.classList.add('wrappable');if(growVertically){this._contentElement.classList.add('toolbar-grow-vertical');}}
makeVertical(){this._contentElement.classList.add('vertical');}
makeBlueOnHover(){this._contentElement.classList.add('toolbar-blue-on-hover');}
makeToggledGray(){this._contentElement.classList.add('toolbar-toggled-gray');}
renderAsLinks(){this._contentElement.classList.add('toolbar-render-as-links');}
empty(){return!this._items.length;}
setEnabled(enabled){this._enabled=enabled;for(const item of this._items){item._applyEnabledState(this._enabled&&item._enabled);}}
appendToolbarItem(item){this._items.push(item);item._toolbar=this;if(!this._enabled){item._applyEnabledState(false);}
this._contentElement.insertBefore(item.element,this._insertionPoint);this._hideSeparatorDupes();}
appendSeparator(){this.appendToolbarItem(new ToolbarSeparator());}
appendSpacer(){this.appendToolbarItem(new ToolbarSeparator(true));}
appendText(text){this.appendToolbarItem(new ToolbarText(text));}
removeToolbarItems(){for(const item of this._items){delete item._toolbar;}
this._items=[];this._contentElement.removeChildren();this._insertionPoint=this._contentElement.createChild('slot');}
setColor(color){const style=createElement('style');style.textContent='.toolbar-glyph { background-color: '+color+' !important }';this._shadowRoot.appendChild(style);}
setToggledColor(color){const style=createElement('style');style.textContent='.toolbar-button.toolbar-state-on .toolbar-glyph { background-color: '+color+' !important }';this._shadowRoot.appendChild(style);}
_hideSeparatorDupes(){if(!this._items.length){return;}
let previousIsSeparator=false;let lastSeparator;let nonSeparatorVisible=false;for(let i=0;i<this._items.length;++i){if(this._items[i]instanceof ToolbarSeparator){this._items[i].setVisible(!previousIsSeparator);previousIsSeparator=true;lastSeparator=this._items[i];continue;}
if(this._items[i].visible()){previousIsSeparator=false;lastSeparator=null;nonSeparatorVisible=true;}}
if(lastSeparator&&lastSeparator!==this._items.peekLast()){lastSeparator.setVisible(false);}
this.element.classList.toggle('hidden',!!lastSeparator&&lastSeparator.visible()&&!nonSeparatorVisible);}
async appendItemsAtLocation(location){const extensions=self.runtime.extensions(Provider);const filtered=extensions.filter(e=>e.descriptor()['location']===location);const items=await Promise.all(filtered.map(extension=>{const descriptor=extension.descriptor();if(descriptor['separator']){return new ToolbarSeparator();}
if(descriptor['actionId']){return UI.Toolbar.createActionButtonForId(descriptor['actionId'],descriptor['showLabel']);}
return extension.instance().then(p=>p.item());}));items.filter(item=>item).forEach(item=>this.appendToolbarItem(item));}}
export class ToolbarItem extends Common.Object{constructor(element){super();this.element=element;this.element.classList.add('toolbar-item');this._visible=true;this._enabled=true;}
setTitle(title){if(this._title===title){return;}
this._title=title;UI.ARIAUtils.setAccessibleName(this.element,title);UI.Tooltip.install(this.element,title);}
setEnabled(value){if(this._enabled===value){return;}
this._enabled=value;this._applyEnabledState(this._enabled&&(!this._toolbar||this._toolbar._enabled));}
_applyEnabledState(enabled){this.element.disabled=!enabled;}
visible(){return this._visible;}
setVisible(x){if(this._visible===x){return;}
this.element.classList.toggle('hidden',!x);this._visible=x;if(this._toolbar&&!(this instanceof ToolbarSeparator)){this._toolbar._hideSeparatorDupes();}}
setRightAligned(alignRight){this.element.classList.toggle('toolbar-item-right-aligned',alignRight);}}
export class ToolbarText extends ToolbarItem{constructor(text){super(createElementWithClass('div','toolbar-text'));this.element.classList.add('toolbar-text');this.setText(text||'');}
text(){return this.element.textContent;}
setText(text){this.element.textContent=text;}}
export class ToolbarButton extends ToolbarItem{constructor(title,glyph,text){super(createElementWithClass('button','toolbar-button'));this.element.addEventListener('click',this._clicked.bind(this),false);this.element.addEventListener('mousedown',this._mouseDown.bind(this),false);this._glyphElement=UI.Icon.create('','toolbar-glyph hidden');this.element.appendChild(this._glyphElement);this._textElement=this.element.createChild('div','toolbar-text hidden');this.setTitle(title);if(glyph){this.setGlyph(glyph);}
this.setText(text||'');this._title='';}
setText(text){if(this._text===text){return;}
this._textElement.textContent=text;this._textElement.classList.toggle('hidden',!text);this._text=text;}
setGlyph(glyph){if(this._glyph===glyph){return;}
this._glyphElement.setIconType(glyph);this._glyphElement.classList.toggle('hidden',!glyph);this.element.classList.toggle('toolbar-has-glyph',!!glyph);this._glyph=glyph;}
setBackgroundImage(iconURL){this.element.style.backgroundImage='url('+iconURL+')';}
setDarkText(){this.element.classList.add('dark-text');}
turnIntoSelect(width){this.element.classList.add('toolbar-has-dropdown');const dropdownArrowIcon=UI.Icon.create('smallicon-triangle-down','toolbar-dropdown-arrow');this.element.appendChild(dropdownArrowIcon);if(width){this.element.style.width=width+'px';}}
_clicked(event){if(!this._enabled){return;}
this.dispatchEventToListeners(ToolbarButton.Events.Click,event);event.consume();}
_mouseDown(event){if(!this._enabled){return;}
this.dispatchEventToListeners(ToolbarButton.Events.MouseDown,event);}}
ToolbarButton.Events={Click:Symbol('Click'),MouseDown:Symbol('MouseDown')};export class ToolbarInput extends ToolbarItem{constructor(placeholder,accessiblePlaceholder,growFactor,shrinkFactor,tooltip,completions){super(createElementWithClass('div','toolbar-input'));const internalPromptElement=this.element.createChild('div','toolbar-input-prompt');internalPromptElement.addEventListener('focus',()=>this.element.classList.add('focused'));internalPromptElement.addEventListener('blur',()=>this.element.classList.remove('focused'));this._prompt=new UI.TextPrompt();this._proxyElement=this._prompt.attach(internalPromptElement);this._proxyElement.classList.add('toolbar-prompt-proxy');this._proxyElement.addEventListener('keydown',event=>this._onKeydownCallback(event));this._prompt.initialize(completions||(()=>Promise.resolve([])),' ');if(tooltip){this._prompt.setTitle(tooltip);}
this._prompt.setPlaceholder(placeholder,accessiblePlaceholder);this._prompt.addEventListener(UI.TextPrompt.Events.TextChanged,this._onChangeCallback.bind(this));if(growFactor){this.element.style.flexGrow=growFactor;}
if(shrinkFactor){this.element.style.flexShrink=shrinkFactor;}
const clearButton=this.element.createChild('div','toolbar-input-clear-button');clearButton.appendChild(UI.Icon.create('mediumicon-gray-cross-hover','search-cancel-button'));clearButton.addEventListener('click',()=>{this.setValue('',true);this._prompt.focus();});this._updateEmptyStyles();}
_applyEnabledState(enabled){this._prompt.setEnabled(enabled);}
setValue(value,notify){this._prompt.setText(value);if(notify){this._onChangeCallback();}
this._updateEmptyStyles();}
value(){return this._prompt.textWithCurrentSuggestion();}
_onKeydownCallback(event){if(!isEscKey(event)||!this._prompt.text()){return;}
this.setValue('',true);event.consume(true);}
_onChangeCallback(){this._updateEmptyStyles();this.dispatchEventToListeners(ToolbarInput.Event.TextChanged,this._prompt.text());}
_updateEmptyStyles(){this.element.classList.toggle('toolbar-input-empty',!this._prompt.text());}}
ToolbarInput.Event={TextChanged:Symbol('TextChanged')};export class ToolbarToggle extends ToolbarButton{constructor(title,glyph,toggledGlyph){super(title,glyph,'');this._toggled=false;this._untoggledGlyph=glyph;this._toggledGlyph=toggledGlyph;this.element.classList.add('toolbar-state-off');UI.ARIAUtils.setPressed(this.element,false);}
toggled(){return this._toggled;}
setToggled(toggled){if(this._toggled===toggled){return;}
this._toggled=toggled;this.element.classList.toggle('toolbar-state-on',toggled);this.element.classList.toggle('toolbar-state-off',!toggled);UI.ARIAUtils.setPressed(this.element,toggled);if(this._toggledGlyph&&this._untoggledGlyph){this.setGlyph(toggled?this._toggledGlyph:this._untoggledGlyph);}}
setDefaultWithRedColor(withRedColor){this.element.classList.toggle('toolbar-default-with-red-color',withRedColor);}
setToggleWithRedColor(toggleWithRedColor){this.element.classList.toggle('toolbar-toggle-with-red-color',toggleWithRedColor);}}
export class ToolbarMenuButton extends ToolbarButton{constructor(contextMenuHandler,useSoftMenu){super('','largeicon-menu');this._contextMenuHandler=contextMenuHandler;this._useSoftMenu=!!useSoftMenu;UI.ARIAUtils.markAsMenuButton(this.element);}
_mouseDown(event){if(event.buttons!==1){super._mouseDown(event);return;}
if(!this._triggerTimeout){this._triggerTimeout=setTimeout(this._trigger.bind(this,event),200);}}
_trigger(event){delete this._triggerTimeout;if(this._lastTriggerTime&&Date.now()-this._lastTriggerTime<300){return;}
const contextMenu=new UI.ContextMenu(event,this._useSoftMenu,this.element.totalOffsetLeft(),this.element.totalOffsetTop()+this.element.offsetHeight);this._contextMenuHandler(contextMenu);contextMenu.show();this._lastTriggerTime=Date.now();}
_clicked(event){if(this._triggerTimeout){clearTimeout(this._triggerTimeout);}
this._trigger(event);}}
export class ToolbarSettingToggle extends ToolbarToggle{constructor(setting,glyph,title){super(title,glyph);this._defaultTitle=title;this._setting=setting;this._settingChanged();this._setting.addChangeListener(this._settingChanged,this);}
_settingChanged(){const toggled=this._setting.get();this.setToggled(toggled);this.setTitle(this._defaultTitle);}
_clicked(event){this._setting.set(!this.toggled());super._clicked(event);}}
export class ToolbarSeparator extends ToolbarItem{constructor(spacer){super(createElementWithClass('div',spacer?'toolbar-spacer':'toolbar-divider'));}}
export class Provider{item(){}}
export class ItemsProvider{toolbarItems(){}}
export class ToolbarComboBox extends ToolbarItem{constructor(changeHandler,title,className){super(createElementWithClass('span','toolbar-select-container'));this._selectElement=this.element.createChild('select','toolbar-item');const dropdownArrowIcon=UI.Icon.create('smallicon-triangle-down','toolbar-dropdown-arrow');this.element.appendChild(dropdownArrowIcon);if(changeHandler){this._selectElement.addEventListener('change',changeHandler,false);}
UI.ARIAUtils.setAccessibleName(this._selectElement,title);super.setTitle(title);if(className){this._selectElement.classList.add(className);}}
selectElement(){return(this._selectElement);}
size(){return this._selectElement.childElementCount;}
options(){return Array.prototype.slice.call(this._selectElement.children,0);}
addOption(option){this._selectElement.appendChild(option);}
createOption(label,value){const option=this._selectElement.createChild('option');option.text=label;if(typeof value!=='undefined'){option.value=value;}
return option;}
_applyEnabledState(enabled){super._applyEnabledState(enabled);this._selectElement.disabled=!enabled;}
removeOption(option){this._selectElement.removeChild(option);}
removeOptions(){this._selectElement.removeChildren();}
selectedOption(){if(this._selectElement.selectedIndex>=0){return this._selectElement[this._selectElement.selectedIndex];}
return null;}
select(option){this._selectElement.selectedIndex=Array.prototype.indexOf.call((this._selectElement),option);}
setSelectedIndex(index){this._selectElement.selectedIndex=index;}
selectedIndex(){return this._selectElement.selectedIndex;}
setMaxWidth(width){this._selectElement.style.maxWidth=width+'px';}
setMinWidth(width){this._selectElement.style.minWidth=width+'px';}}
export class ToolbarSettingComboBox extends ToolbarComboBox{constructor(options,setting,accessibleName){super(null,accessibleName);this._options=options;this._setting=setting;this._selectElement.addEventListener('change',this._valueChanged.bind(this),false);this.setOptions(options);setting.addChangeListener(this._settingChanged,this);}
setOptions(options){this._options=options;this._selectElement.removeChildren();for(let i=0;i<options.length;++i){const dataOption=options[i];const option=this.createOption(dataOption.label,dataOption.value);this._selectElement.appendChild(option);if(this._setting.get()===dataOption.value){this.setSelectedIndex(i);}}}
value(){return this._options[this.selectedIndex()].value;}
_settingChanged(){if(this._muteSettingListener){return;}
const value=this._setting.get();for(let i=0;i<this._options.length;++i){if(value===this._options[i].value){this.setSelectedIndex(i);break;}}}
_valueChanged(event){const option=this._options[this.selectedIndex()];this._muteSettingListener=true;this._setting.set(option.value);this._muteSettingListener=false;}}
export class ToolbarCheckbox extends ToolbarItem{constructor(text,tooltip,listener){super(UI.CheckboxLabel.create(text));this.element.classList.add('checkbox');this.inputElement=this.element.checkboxElement;if(tooltip){this.element.title=tooltip;}
if(listener){this.inputElement.addEventListener('click',listener,false);}}
checked(){return this.inputElement.checked;}
setChecked(value){this.inputElement.checked=value;}
_applyEnabledState(enabled){super._applyEnabledState(enabled);this.inputElement.disabled=!enabled;}}
export class ToolbarSettingCheckbox extends ToolbarCheckbox{constructor(setting,tooltip,alternateTitle){super(alternateTitle||setting.title()||'',tooltip);UI.SettingsUI.bindCheckbox(this.inputElement,setting);}}
self.UI=self.UI||{};UI=UI||{};UI.Toolbar=Toolbar;UI.ToolbarItem=ToolbarItem;UI.ToolbarText=ToolbarText;UI.ToolbarButton=ToolbarButton;UI.ToolbarInput=ToolbarInput;UI.ToolbarToggle=ToolbarToggle;UI.ToolbarMenuButton=ToolbarMenuButton;UI.ToolbarSettingToggle=ToolbarSettingToggle;UI.ToolbarSeparator=ToolbarSeparator;UI.ToolbarItem.Provider=Provider;UI.ToolbarItem.ItemsProvider=ItemsProvider;UI.ToolbarComboBox=ToolbarComboBox;UI.ToolbarSettingComboBox=ToolbarSettingComboBox;UI.ToolbarCheckbox=ToolbarCheckbox;UI.ToolbarSettingCheckbox=ToolbarSettingCheckbox;