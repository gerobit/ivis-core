'use strict';

import { getRestUrl } from "../lib/access";

export function fileUrl(filename){
    return getRestUrl(`/template-file/${global.ivisPanelTemplateId}/${encodeURIComponent(filename)}`)
}