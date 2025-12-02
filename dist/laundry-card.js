class LaundryCard extends HTMLElement {

    _config;
    _hass;
    _elements = {};
    _devices = [];
    _entities = {};
    _path = "/local/dist/laundry-card/images/"

    constructor() {
        super();
        this.doCard();
        this.doStyle();
        this.doAttach();
    }

    setConfig(config) {
        this._config = config;
        this.checkConfig();
        this.setDevices();
        this.setEntities();
        this.doUpdateConfig();
    }

    set hass(hass) {
        this._hass = hass;
        this.doUpdateHass();
    }

    isDevice(device) {
        return !(!this._config[device]);
    }

    checkConfig() {
        if ((!this.isDevice("washer")) && (!this.isDevice("dryer"))) {
            throw new Error("You must select at least one washer or dryer")
        }
    }

    setDevices() {
        (this.isDevice("washer")) && this._devices.push("washer");
        (this.isDevice("dryer")) && this._devices.push("dryer");
    }

    // operation entity needs to be changed for final arrangement
    setEntities() {
        this._devices.forEach((device) => {
            this._entities[device] = {};
            this._entities[device].remaining_time =
                "sensor." + this._config[device] + "_remaining_time";
            this._entities[device].current_status =
                "sensor." + this._config[device] + "_current_status";
            this._entities[device].operation =
                "select." + this._config[device] + ".operation";
        })
    }

    doCard() {
        this._elements.card = {};
        this._elements.card.main = document.createElement("ha-card");
        this._elements.card.main.innerHTML = `<div class="row-box"></div>`;
    }

    doMachine(device) {
        this._elements.card[device] = document.createElement("device");
        this._elements.card[device].classList.add("device");
        this._elements.card[device].innerHTML = `
                <h2 class="header ${device}">
                    ${device.charAt(0).toUpperCase() + device.slice(1)}
                </h2>
                <div class="content ${device}">
                    <div class="status ${device}">
                        <img class="image ${device}">
                    </div>
                    <div class="controls ${device}">
                        <div class="switch button ${device}"></div>
                        <div class="switch toggle ${device}"> power-off </div>
                    </div>
                </div>
                <p class="text ${device}"></p>
        `;
    }

    doStyle() {
        this._elements.style = document.createElement("style");
        this._elements.style.textContent = `
            .row-box {
                display: flex;
                flex-flow: row nowrap;
                justify-content: space-around;
            }
            .device {
                display: flex;
                flex-flow: column nowrap;
                justify-content: space-between;
                align-items: center;
                width: 50%;
                height: 100%;
            }
            .header {
                margin-top: 3%;
                margin-bottom: 3%;
            }
            .content {
                display: flex;
                flex-flow: row nowrap;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 90%;
            }
            .status {
                display: flex;
                flex-flow: column nowrap;
                justify-content: space-around;
                align-items: center;
                width: 50%;
                height: 100%;
            }
            .controls {
                display: flex;
                flex-flow: column nowrap;
                justify-content: space-between;
                align-items: flex-start;
                width: 50%;
                height: 100%;
            }
            .text {
                display: flex;
                flex-flow: row nowrap;
                margin-top: 3%;
                margin-bottom: 3%;
            }
            .switch {
                margin-top: 5%;
                margin-bottom: 5%;
                display: flex;
                flex-flow: row nowrap;
                justify-content: center;
                align-items: center;
                border-radius: 7px;
                border: solid;
                border-width: thin;
                width: 80%;
            }
            .switch.button.off {
                background-color: #BDD9BD;
            }
            .switch.button.off:hover {
                background-color: #7AB37A;
            }
            .switch.button.on {
                background-color: #DBB6AB;
            }
            .switch.button.on:hover {
                background-color: #C0806D;
            }
            .switch.toggle {
                background-color: #DBB6AB;
            }
            .switch.toggle:hover {
                background-color: #C0806D;
            }
        `;
    }

    doAttach() {
        this.attachShadow({ mode: "open" })
        this.shadowRoot.append(this._elements.card.main, this._elements.style);
    }

    doAttachDevice(device) {
        const card = this._elements.card.main;
        this.doMachine(device);
        card.querySelector(".row-box").append(this._elements.card[device])
    }

    doQueryDeviceElements(device) {
        const node = this._elements.card[device];
        this._elements[device] = {};
        this._elements[device].image = node.querySelector(".image");
        this._elements[device].text = node.querySelector(".text");
        this._elements[device].button = node.querySelector(".button");
        this._elements[device].toggle = node.querySelector(".toggle");
    }

    doUpdateConfig() {
        this._devices.forEach((device) => {
            this.doAttachDevice(device)
            this.doQueryDeviceElements(device)
            this.doListenButton(device);
            this.doListenToggle(device);
        })
    }

    doListenButton(device) {
        this._elements[device].button.addEventListener(
            "click", this.doPressButton(device).bind(this), false);
    }

    doListenToggle(device) {
        this._elements[device].toggle.addEventListener(
            "click", this.doToggle(device).bind(this), false);
    }

    doUpdateHass() {
        this._devices.forEach((device) => {
            setInterval(this.updateTimeDisplay(device), 1000);
            let src = this.getImageSrc(device);
            this._elements[device].image.setAttribute("src", src);
            const status = this.getMachineStatus(device);
            if ((status === "power-off") || (status === "end")) {
                this._elements[device].button.remove();
                this._elements[device].toggle.remove();
            } else if (status === "pause") {
                this._elements[device].button.classList.remove("on");
                this._elements[device].button.classList.add("off");
                this._elements[device].button.textContent = "resume";
            }
            else {
                this._elements[device].button.classList.add("on");
                this._elements[device].button.classList.remove("off");
                this._elements[device].button.textContent = "pause";
            }
        })
    }

    updateTimeDisplay(device) {
        return () => {
            this._elements[device].text.textContent = this.getMessage(device);
        }
    }

    pad(value) {
        let string = String(value);
        if (string.length === 1) {
            string = "0" + string;
        }
        return string;
    }

    getRemainingTime(device) {
        const entityId = this._entities[device].remaining_time;
        const timeState = this._hass.states[entityId].state;
        let message = "";
        if (timeState) {
            let remaining = Date.parse(timeState) - Date.now();
            const hours = Math.floor(remaining / 3600000)
            remaining = remaining - hours * 3600000;
            const minutes = Math.floor(remaining / 60000);
            remaining = remaining - minutes * 60000;
            const seconds = Math.floor(remaining / 1000);
            const time = String(hours) + ":" + this.pad(minutes) + ":" + this.pad(seconds);
            message = ": " + time + " left";
        }
        return message;
    }

    getMessage(device) {
        let status = this.getMachineStatus(device);
        status = status.charAt(0).toUpperCase() + status.slice(1);
        if (!(status === "End") && !(status === "Power-off" && !(status === "Detecting"))) {
            status = status + this.getRemainingTime(device);
        }
        return status;
    }

    getMachineStatus(device) {
        const entityId = this._entities[device].current_status;
        const state = this._hass.states[entityId];
        const status = state.state;
        return status;
    }

    getMachineSimpleStatus(device) {
        const status = this.getMachineStatus(device);
        let simpleStatus;
        switch (status) {
            case "power_off":
            case "end":
                simpleStatus = "off";
                break;
            case "initial":
            case "pause":
                simpleStatus = "paused";
                break;
            case "detecting":
            case "running":
            case "rinsing":
            case "spinning":
            case "cooling":
                simpleStatus = "on";
                break;
            default:
                simpleStatus = "unknown";
        }
        return simpleStatus;
    }

    getImageSrc(device) {
        const status = this.getMachineSimpleStatus(device);
        const path = this._path + device;
        const end = ".png"
        let src;
        switch (status) {
            case "off":
                src = path + "_off" + end;
                break;
            case "paused":
                src = path + "_standby" + end;
                break;
            case "on":
                src = path + "_running" + end;
                break;
            default:
                src = path + "1" + end;
        }
        return src;
    }

    doPressButton(device) {
        return () => {
            const status = this.getMachineSimpleStatus(device);
            const entityId = this._entities[device].operation;
            const data = { entity_id: entityId };
            if (status === "on") {
                data.option = "stop";
            } else if (status === "paused") {
                data.option = "start";
            }
            this._hass.callService('select', 'select_option', data);
        };
    }

    doToggle(device) {
        return () => {
            const entityId = this._entities[device].operation;
            const data = { entity_id: entityId, option: "power_off" };
            this._hass.callService('input_select', 'select_option', data);
        }
    }

// configuration defaults
    static getStubConfig() {
        return {
            washer: "",
            dryer: ""
         }
    }

    getCardSize() {
        return 4;
    }

    getGridOptions() {
        return {
            rows: 3,
            columns: 9,
            min_rows: 3,
            max_rows: 3
        }
    }

    static getConfigElement() {
        return document.createElement("laundry-card-editor");
    }

}

class LaundryCardEditor extends HTMLElement {

    _config;
    _hass;
    _elements = {};

    constructor() {
        super();
        this.doEditor();
        this.doStyle();
        this.doAttach();
        this.doQueryElements();
        this.doListen();
    }

    setConfig(config) {
        this._config = config;
        this.doUpdateConfig();
    }

    set hass(hass) {
        this._hass = hass;
        this.doUpdateHass();
    }

    doEditor() {
        this._elements.editor = document.createElement("form");
        this._elements.editor.innerHTML = `
            <div class="row">
                <label class="label" for="washer"> Washer: </label>
                <input class="value" id="washer"></input>
            </div>
            <div class="row">
                <label class="label" for="dryer"> Dryer: </label>
                <input class="value" id="dryer"></input>
            </div>
        `;
    }

    doStyle() {
        this._elements.style = document.createElement("style");
        this._elements.style.textContent = `
            form {
                display: table;
                padding: 3%;
            }
            .row {
                margin-top: 5%;
                margin-bottom: 5%;
                display: flex;
                flex-flow: row nowrap;
                justify-content: space-between;
            }
            .label {
                width: 25%;
                display: flex;
                flex-flow: row nowrap;
                justify-content: flex-start;
            }
            .value {
                width: 75%;
                display: flex;
                flex-flow: row nowrap;
                justify-content: flex-end;
            }
        `;
    }

    doAttach() {
        this.attachShadow({ mode: "open" })
        this.shadowRoot.append(this._elements.editor, this._elements.style);
    }

    doQueryElements() {
        this._elements.washer = this._elements.editor.querySelector("#washer");
        this._elements.dryer = this._elements.editor.querySelector("#dryer");
    }

    doListen() {
        this._elements.washer.addEventListener(
            "focusout",
            this.onChanged.bind(this)
        );
        this._elements.dryer.addEventListener(
            "focusout",
            this.onChanged.bind(this)
        );
    }

    doUpdateConfig() {
        this._elements.washer.value = this._config.washer;
        this._elements.dryer.value = this._config.dryer;
    }

    doUpdateHass() { }

    onChanged(event) {
        this.doMessageForUpdate(event);
    }

    doMessageForUpdate(changedEvent) {
        // this config if read-only, make a copy so you can modify it
        const newConfig = Object.assign({}, this._config);
        if (changedEvent.target.id == "washer") {
            newConfig.washer = changedEvent.target.value;
        } else if (changedEvent.target.id == "dryer") {
            newConfig.dryer = changedEvent.target.value;
        }
        const messageEvent = new CustomEvent("config-changed", {
            detail: { config: newConfig },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(messageEvent);
    }

}

customElements.define('laundry-card', LaundryCard);

customElements.define('laundry-card-editor', LaundryCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "laundry-card",
    name: "Laundry Card",
    description: "A custom card made by me!"
});