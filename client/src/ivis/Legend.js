import React, {Component} from "react";
import PropTypes from "prop-types";
import styles from './Legend.scss';
import {
    Configurator,
    PanelConfigAccess
} from './PanelConfig';
import {ActionLink} from "../lib/bootstrap-components";

export class StaticLegend extends Component {
    constructor(props) {
        super(props);

        this.state = {
            configuratorOpened: false
        }
    }

    static propTypes = {
        label: PropTypes.string,
        labelClassName: PropTypes.string,
        structure: PropTypes.array,
        config: PropTypes.array.isRequired,
        onChange: PropTypes.func,
        className: PropTypes.string,
        rowClassName: PropTypes.string,
        withConfigurator: PropTypes.bool,
        configSpec: PropTypes.object
    }

    static defaultProps = {
        labelClassName: 'h4',
        structure: [
            {
                childrenAttr: 'signals'
            },
            {
                labelAttr: 'label',
                colorAttr: 'color',
                selectionAttr: 'enabled'
            }
        ],
        rowClassName: 'col-12'
    }

    onConfigChanged(config) {
        this.props.onChange([], config)
    }

    async openConfigurator() {
        this.setState({
            configuratorOpened: true
        });
    }

    async closeConfigurator() {
        this.setState({
            configuratorOpened: false
        });
    }

    render() {
        const legendRows = [];
        const props = this.props;

        function processChildren(children, level, idPrefix, path) {
            const structureEntry = props.structure[level];

            for (let entryIdx = 0; entryIdx < children.length; entryIdx++) {
                const entry = children[entryIdx];
                const entryId = idPrefix + ' ' + entryIdx;
                const entryPath = [...path, entryIdx];
                
                if (level < props.structure.length - 1) {
                    processChildren(entry[structureEntry.childrenAttr], level + 1, entryId, entryPath);
                } else {
                    legendRows.push(
                        <div className={`${props.rowClassName} ${styles.legendRow}`} key={entryId}>
                            <label>
                                {props.onChange &&
                                <input
                                    type="checkbox"
                                    checked={entry[structureEntry.selectionAttr]}
                                    onChange={evt => props.onChange([...entryPath, structureEntry.selectionAttr], !entry[structureEntry.selectionAttr])}/>
                                }
                                <span className={styles.color} style={{backgroundColor: entry[structureEntry.colorAttr]}}></span>
                                <span className={styles.label}>{entry[structureEntry.labelAttr]}</span>
                            </label>
                        </div>
                    );
                }
            }
        }

        processChildren(props.config, 0, '', []);

        if (this.state.configuratorOpened) {
            return (
                <div className={`${styles.legend} ${props.className}`}>
                    <div className={`${styles.label} ${this.props.labelClassName}`}><span className={styles.labelText}>{this.props.label}</span></div>
                    <div className={styles.configurator}>
                        <Configurator
                            onChange={::this.onConfigChanged}
                            config={props.config}
                            configSpec={props.configSpec}
                            onCloseAsync={::this.closeConfigurator}
                        />
                    </div>
                </div>
            );
        } else {
            return (
                <div className={`${styles.legend} ${props.className}`}>
                    <div className={`${styles.label} ${this.props.labelClassName}`}>
                        <span className={styles.labelText}>{this.props.label}</span>
                        { props.withConfigurator &&
                            <ActionLink className={styles.editLink} onClickAsync={::this.openConfigurator}>[edit]</ActionLink>
                        }
                    </div>
                    <div className="row">
                        {legendRows}
                    </div>
                </div>
            );
        }
    }
}

export class Legend extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        label: PropTypes.string,
        labelClassName: PropTypes.string,
        configPath: PropTypes.array.isRequired,
        structure: PropTypes.array,
        className: PropTypes.string,
        rowClassName: PropTypes.string,
        withSelector: PropTypes.bool,
        withConfigurator: PropTypes.bool,
        configSpec: PropTypes.object,
        withConfiguratorForAllUsers: PropTypes.bool
    }

    render() {
        return (
            <PanelConfigAccess configPath={this.props.configPath} render={
                (config, isSavePermitted, onChange) =>
                    <StaticLegend
                        label={this.props.label}
                        labelClassName={this.props.labelClassName}
                        config={config}
                        onChange={this.props.withSelector ? onChange : null}
                        structure={this.props.structure}
                        className={this.props.className}
                        rowClassName={this.props.rowClassName}
                        withConfigurator={this.props.withConfiguratorForAllUsers || (this.props.withConfigurator && isSavePermitted)}
                        configSpec={this.props.configSpec}
                    />
            }/>
        );
    }
}
