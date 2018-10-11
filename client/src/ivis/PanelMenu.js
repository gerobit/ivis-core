export function withPanelMenu(target) {
    const comp1 = target;

    function comp2(props, context) {
        if (!new.target) {
            throw new TypeError();
        }

        const self = Reflect.construct(comp1, [props, context], new.target);

        self._panelMenu = new Map();

        return self;
    }


    const inst = comp2.prototype = comp1.prototype;

    for (const attr in comp1) {
        comp2[attr] = comp1[attr];
    }

    function resetMenu(owner) {
        const items = Array.from(owner._panelMenu);
        items.sort((a, b) => (a[1].weight || 0 ) - (b[1].weight || 0));

        const menu = [];
        for (const item of items) {
            menu.push({
                label: item[1].label,
                action: item[0],
                disabled: item[1].disabled
            });
        }

        owner.props.setPanelMenu(menu);
    }

    const previousComponentDidMount = inst.componentDidMount;
    inst.componentDidMount = function() {
        resetMenu(this);

        if (previousComponentDidMount) {
            previousComponentDidMount.apply(this);
        }
    };

    inst.updatePanelMenu = function(updates) {
        for (const key in updates) {
            const entry = updates[key];
            if (!entry) {
                this._panelMenu.delete(key);
            } else {
                this._panelMenu.set(key, entry);
            }
        }

        resetMenu(this);
    };

    // This enables/disables menu items. It ignores those which are not in the menu. This allows writing code that doesn't have to care about whether
    // a particular menu item has been omitted due to insufficient permissions
    inst.updatePanelMenuEnabled = function(updates) {
        for (const key in updates) {
            if (this._panelMenu.has(key)) {
                const entry = this._panelMenu.get(key);
                entry.disabled = !updates[key];
            }
        }

        resetMenu(this);
    };

    inst.onPanelMenuAction = function(action) {
        const entry = this._panelMenu.get(action);
        if (entry) {
            if (!entry.disabled && entry.action) {
                entry.action();
            }
        }
    };

    return comp2;
}
