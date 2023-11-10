const DATA_ATTR_BUTTON_ACTION = "data-button-action";

const domButtons = [...document.querySelectorAll(`[${DATA_ATTR_BUTTON_ACTION}]`)];

const ACTION_TYPE_NORMAL = "normal";
const ACTION_TYPE_TOGGLE = "toggle";

const initializeButtons = () => {
    
};

class UI {
    constructor(){
        this.UIElements = [];
    }

    add(element){
        this.UIElements.push(element);
    }
}

class UIButton {
    constructor(domNode, type, data={}){
        this.domNode = domNode;
        this.type = type;
        this.data = data;
    }
}

const ui = new UI();

const initialize = () => {
    for(const button of domButtons){
        console.log("Initializing", button);

        const buttonAction = button.getAttribute(DATA_ATTR_BUTTON_ACTION);

        const actionComponents = buttonAction.split(':');
        const actionType = actionComponents > 1 ? actionComponents[0] : null;
        
        const uiButton = new UIButton(button, actionType, {});
        ui.add(uiButton);
    }
};

initialize();

console.log(ui);
