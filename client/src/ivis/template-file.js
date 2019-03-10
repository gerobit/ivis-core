'use strict';

import {getUrl} from "../lib/urls";

export function fileUrl(filename){
    return getUrl(`files/template/file/${global.ivisPanelTemplateId}/${encodeURIComponent(filename)}`)
}
