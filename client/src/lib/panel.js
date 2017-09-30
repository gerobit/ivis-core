'use strict';

import React, { Component } from 'react';
import { translate } from 'react-i18next';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';

class Panel extends Component {
    static propTypes = {
        title: PropTypes.string,
        className: PropTypes.string
    }

    render() {
        const props = this.props;

        return (
            <div className="panel panel-default">
                {props.title &&
                    <div className="panel-heading">
                        <h3 className="panel-title">{props.title}</h3>
                    </div>
                }
                <div className="panel-body">
                    {props.children}
                </div>
            </div>
        );
    }
}


export {
    Panel
};