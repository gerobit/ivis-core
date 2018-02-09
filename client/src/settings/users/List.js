'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {NavButton, Toolbar} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";

@translate()
export default class List extends Component {
    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: t('Username') },
            { data: 2, title: t('Full Name') },
            { data: 3, title: t('Email') },
            { data: 4, title: t('Cell') },
            { data: 5, title: t('Address') },
            { data: 6, title: t('Namespace') },
            { data: 7, title: t('Role') },
            {
                actions: data => [
                    {
                        label: <Icon icon="edit" title={t('Edit')}/>,
                        link: `/settings/users/${data[0]}/edit`
                    },
                    {
                        label: <Icon icon="share" title={t('Share')}/>,
                        link: `/settings/users/${data[0]}/shares`
                    }
                ]
            }
        ];


        return (
            <Panel title={t('Users')}>
                <Toolbar>
                    <NavButton linkTo="/settings/users/create" className="btn-primary" icon="plus" label={t('Create User')}/>
                </Toolbar>

                <Table withHeader dataUrl="/rest/users-table" columns={columns} />
            </Panel>
        );
    }
}