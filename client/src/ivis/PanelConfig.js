import React, {Component} from "react";
import Immutable from 'immutable';
import PropTypes from "prop-types";

export function withPanelConfig(comp1) {
    function comp2(props, context) {
        comp1.apply(this, props, context);

        if (!this.state) {
            this.state = {};
        }

        const config = Immutable.fromJS(props.params).toJS(); // This is just a convenient deep clone

        if (comp1.prototype.preparePanelConfig) {
            this.preparePanelConfig(config);
        }

        this.state._panelConfig = Immutable.Map({
            params: config
        });
    }

    comp2.prototype = comp1.prototype;

    for (const attr in comp1) {
        comp2[attr] = comp1[attr];
    }

    comp2.prototype.getPanelConfig = function(path = []) {
        const value = this.state._panelConfig.getIn(['params', ...path]);
        if (Immutable.isImmutable(value)) {
            return value.toJS();
        } else {
            return value;
        }
    };

    comp2.prototype.updatePanelConfig = function(path, newValue) {
        this.setState({
            _panelConfig: this.state._panelConfig.setIn(['params', ...path], Immutable.fromJS(newValue))
        });
    }

    return comp2;
}

export class PanelConfigAccess extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        owner: PropTypes.object.isRequired,
        path: PropTypes.array.isRequired,
        render: PropTypes.func.isRequired
    }

    render() {
        const owner = this.props.owner;
        return this.props.render(
            owner.getPanelConfig(this.props.path),
            (path, newValue) => {
                owner.updatePanelConfig([...this.props.path, ...path], newValue);
            }
        );
    }
}
