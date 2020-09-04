import configOptions, { ConfigOption, ConfigValue } from "./config";

export default new (class ConfigController {
    public constructor() {
        this.loadconfig();
    }

    public loadconfig() {
        for (const val of Object.values(configOptions)) {
            this.getconfig(val);
        }
        console.log("Configuration loaded", configOptions);
    }

    public saveconfig(newconfig: { [key: string]: ConfigOption }) {
        for (const [key, val] of Object.entries(newconfig)) {
            this.setconfig(key, val);
        }
        console.log("Configuration saved", configOptions);
    }

    private setconfig(key: string, option: ConfigOption) {
        if (option?.value === undefined) return this.deleteconfig(key);

        //safeties
        switch (option.type) {
            case "bool":
                if (typeof option.value !== "boolean") return;
                break;
            case "num":
                //this parses strings and numbers alike to numbers and refuses non numbers
                //@ts-expect-error //parseInt can take numbers
                option.value = parseInt(option.value);
                if (Number.isNaN(option.value)) return;
                break;
            case "str":
            case "pwd":
                if (typeof option.value !== "string") return;
                break;
        }

        configOptions[key].value = option.value;
        //configOptions[key].persist = option.persist;

        //if (!option.persist) return this.deleteconfig(key); //idiot proofing, alexkar proofing

        try {
            localStorage.setItem(option.id, JSON.stringify(option.value));
            //option.persist = true;
        } catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            (() => {})(); //noop
        }
    }

    private getconfig(option: ConfigOption): ConfigValue {
        try {
            const data = localStorage.getItem(option.id);
            if (data !== null) {
                option.value = JSON.parse(data) as ConfigValue;
                //option.persist = true;
            }
        } catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            (() => {})(); //noop
        }
        return;
    }

    private deleteconfig(key: string): void {
        try {
            const option = configOptions[key];
            localStorage.removeItem(option.id);
            //option.persist = false;
        } catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            (() => {})(); //noop
        }
    }
})();
