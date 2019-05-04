import React, {Component} from "react";
import PropTypes from "prop-types";
import {PanelConfigAccess} from './PanelConfig';
import {Button} from "../lib/bootstrap-components";
import {Table, TableSelectMode} from "../lib/table";
import formStyles from "../lib/styles.scss";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {getSignalTypes} from "../settings/signal-sets/signals/signal-types";
import moment from "moment";

@withComponentMixins([
    withTranslation
])
export class StaticSignalSelector extends Component {
    constructor(props) {
        super(props);

        this.state = {
            selectedLabel: '',
            open: false
        };

        this.signalTypes = getSignalTypes(props.t);
    }

    static propTypes = {
        sigSetCid: PropTypes.string,
        sigCid: PropTypes.string,
        onChange: PropTypes.func,
        className: PropTypes.string
    }

    static defaultProps = {
    }

    async onSelectionChangedAsync(sel, data) {
        this.setState({
            open: false
        });

        this.props.onChange(sel);
    }

    async onSelectionDataAsync(sel, data) {
        let label;

        if (!data) {
            label = '';
        } else {
            label = data[2];
        }

        this.setState({
            selectedLabel: label
        });
    }

    async toggleOpen() {
        this.setState({
            open: !this.state.open
        });
    }

    render() {
        const signalColumns = [
            {data: 1, title: t('Id')},
            {data: 2, title: t('Name')},
            {data: 3, title: t('Description')},
            {data: 4, title: t('Type'), render: data => this.signalTypes[data]},
            {data: 5, title: t('Created'), render: data => moment(data).fromNow()},
            {data: 6, title: t('Namespace')}
        ];

        return (
            <div className={this.props.className}>
                <div>
                    <div className={'input-group ' + formStyles.tableSelectDropdown}>
                        <input type="text" className={className} value={this.state.selectedLabel} onClick={::this.toggleOpen}/>
                        <div className="input-group-append">
                            <Button label={t('select')} className="btn-secondary" onClickAsync={::this.toggleOpen}/>
                        </div>
                    </div>
                    <div className={formStyles.tableSelectTable + (this.state.open ? '' : ' ' + formStyles.tableSelectTableHidden)}>
                        <Table
                            columns={signalColumns}
                            withHeader
                            selectMode={TableSelectMode.SINGLE}
                            selectionLabelIndex={2}
                            selectionKeyIndex={1}
                            dataUrl={`rest/signals-table-by-cid/${this.props.sigSetCid}`}
                            selection={this.props.sigCid}
                            onSelectionDataAsync={::this.onSelectionDataAsync}
                            onSelectionChangedAsync={::this.onSelectionChangedAsync}
                        />;
                    </div>
                </div>
            </div>
        );
    }
}

export class SignalSelector extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        sigSetCid: PropTypes.string,
        configPath: PropTypes.array.isRequired,
        className: PropTypes.string
    }

    render() {
        return (
            <PanelConfigAccess configPath={this.props.configPath} render={
                (config, isSavePermitted, onChange) =>
                    <StaticSignalSelector
                        sigSetCid={this.props.sigSetCid}
                        sigCid={config}
                        onChange={sigCid => onChange([], sigCid)}
                        className={this.props.className}
                    />
            }/>
        );
    }
}
