import React, {Component} from "react";
import PropTypes from "prop-types";
import styles from './Legend.scss';
import {
    Configurator,
    DisplayOptions,
    PanelConfigAccess
} from './PanelConfig';
import {Button} from "../lib/bootstrap-components";

export class StaticLegend extends Component {
    constructor(props) {
        super(props);

        this.state = {
            configuratorOpened: false
        }
    }

    static propTypes = {
        structure: PropTypes.array,
        config: PropTypes.array.isRequired,
        onChange: PropTypes.func,
        className: PropTypes.string,
        rowClassName: PropTypes.string,
        withConfigurator: PropTypes.bool,
        configSpec: PropTypes.object,
        configuratorDisplay: PropTypes.number
    }

    static defaultProps = {
        structure: [
            {
                cidAttr: 'cid',
                childrenAttr: 'signals',
                labelAttr: 'label',
                colorAttr: 'color'
            },
            {
                cidAttr: 'cid',
                labelAttr: 'label',
                colorAttr: 'color',
                selectionAttr: 'enabled'
            }
        ],
        rowClassName: 'col-xs-12',
        configuratorDisplay: DisplayOptions.WITHOUT_SAVE
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
                const cid = structureEntry.cidAttr ? entry[structureEntry.cidAttr] : entryIdx;
                const entryId = idPrefix + '-' + cid;
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
                <Configurator
                    display={props.configuratorDisplay}
                    onChange={::this.onConfigChanged}
                    config={props.config}
                    configSpec={props.configSpec}
                    onCloseAsync={::this.closeConfigurator}
                />
            );
        } else {
            return (
                <div className={`${styles.legend} ${props.className}`}>
                    <div className="row">
                        {legendRows}
                    </div>
                    {props.withConfigurator &&
                        <Button
                            className={`btn-default ${styles.configuratorButton}`}
                            icon="cog"
                            onClickAsync={::this.openConfigurator}
                        />
                    }
                </div>
            );
        }
    }
}

/*
export function setSelectionDefault(config, structure, enabled = true) {
    function processChildren(children, level) {
        const structureEntry = structure[level];

        for (let entryIdx = 0; entryIdx < children.length; entryIdx++) {
            const entry = children[entryIdx];

            if (level < structure.length - 1) {
                processChildren(entry[structureEntry.childrenAttr], level + 1);
            } else {
                if (!(structureEntry.selectionAttr in entry)) {
                    entry[structureEntry.selectionAttr] = enabled
                }
            }
        }
    }

    processChildren(config, 0);
}
*/

export class Legend extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        owner: PropTypes.object.isRequired,
        path: PropTypes.array.isRequired,
        structure: PropTypes.array,
        className: PropTypes.string,
        rowClassName: PropTypes.string,
        withSelector: PropTypes.bool,
        withConfigurator: PropTypes.bool,
        configSpec: PropTypes.object,
        configuratorDisplay: PropTypes.number
    }

    render() {
        return (
            <PanelConfigAccess owner={this.props.owner} path={this.props.path} render={
                (config, onChange) =>
                    <StaticLegend
                        config={config}
                        onChange={this.props.withSelector ? onChange : null}
                        structure={this.props.structure}
                        rowClassName={this.props.rowClassName}
                        withConfigurator={this.props.withConfigurator}
                        configSpec={this.props.configSpec}
                        configuratorDisplay={this.props.configuratorDisplay}
                    />
            }/>
        );
    }
}
