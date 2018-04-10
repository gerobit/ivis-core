'use strict';

import {getUrl} from "../lib/urls";

export function fileUrl(filename){
    return getUrl(`template-file/${global.ivisPanelTemplateId}/${encodeURIComponent(filename)}`)
}