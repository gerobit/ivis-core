"use strict";

exports.seed = (knex, Promise) => (async() => {
    const settings = {
        params: [
            {
                "id": "title",
                "label": "Title",
                "type": "string"
            },
            {
                "id": "intro",
                "label": "Introduction paragraph",
                "help": "An introduction paragraph that appears above the linechart",
                "type": "text"
            },
            {
                "id": "sigSet",
                "label": "Signal Set",
                "help": "Signal set for the sensors",
                "type": "signalSet"
            },
            {
                "id": "sensors",
                "label": "Sensors",
                "help": "Sensors visualized in the linechart below the introduction paragraph",
                "type": "fieldset",
                "cardinality": "1..n",
                "children": [
                    {
                        "id": "label",
                        "label": "Label",
                        "type": "string"
                    },
                    {
                        "id": "color",
                        "label": "Color",
                        "type": "color"
                    },
                    {
                        "id": "cid",
                        "label": "Sensor",
                        "type": "signal",
                        "signalSet": "sigSet"
                    }
                ]
            }
        ],
        jsx:
            "'use strict';\n" +
            "\n" +
            "import React, {Component} from \"react\";\n" +
            "import styles from './styles.scss';\n" +
            "import {TimeContext, TimeRangeSelector, LineChart} from \"ivis\";\n" +
            "\n" +
            "export default class Test extends Component {\n" +
            "  constructor(props) {\n" +
            "    super(props);\n" +
            "\n" +
            "    this.config = {\n" +
            "      yScale: {\n" +
            "        includedMin: 0,\n" +
            "        includedMax: 100\n" +
            "      },\n" +
            "      signals: props.params.sensors\n" +
            "    };\n" +
            "  }\n" +
            "\n" +
            "  render() {\n" +
            "    return (\n" +
            "      <TimeContext>\n" +
            "        <div className=\"row\">\n" +
            "          <div className=\"col-xs-12\">\n" +
            "            <TimeRangeSelector/>\n" +
            "          </div>\n" +
            "          <div className=\"col-xs-12\">\n" +
            "            <div>\n" +
            "              <LineChart\n" +
            "                config={this.config}\n" +
            "                height={500}\n" +
            "                margin={{ left: 40, right: 5, top: 5, bottom: 20 }}\n" +
            "                withTooltip\n" +
            "              />\n" +
            "            </div>\n" +
            "          </div>\n" +
            "        </div>\n" +
            "      </TimeContext>\n" +
            "    );\n" +
            "  }\n" +
            "}\n",
        scss:
            ".xxx {\n" +
            "  font-weight: bold;\n" +
            "}\n"
    };

    await knex('templates').insert({
        id: 1,
        name: 'Curabitur porttitor',
        description: ' Curabitur porttitor, sapien vitae elementum ultrices, lorem.',
        type: 'jsx',
        settings: JSON.stringify(settings),
        state: 1,
        namespace: 1
    });


    await knex('workspaces').insert({
        id: 1,
        name: 'Aenean sit',
        description: 'Mauris et nibh rhoncus, mollis ex cursus, faucibus neque.',
        order: 1,
        namespace: 1
    });


    const params = {
        title: 'Nulla ipsum ipsum',
        intro: 'Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Pellentesque pharetra, nisl quis dignissim ultricies, nibh risus ultrices odio, quis volutpat dui dui quis augue. Curabitur vestibulum augue posuere nunc dignissim ullamcorper. Suspendisse quis sapien facilisis, sagittis justo in, dignissim tortor. Proin lacinia fringilla lorem, sit amet consectetur justo tristique eget. Nunc egestas arcu ac ligula pharetra ullamcorper. Duis in luctus lacus.',
        sensors: [
            {
                label: 'Sensor 1',
                color: {r: 216, g: 0, b: 0, a: 1},
                cid: 'sensor1'
            },
            {
                label: 'Sensor 2',
                color: {r: 34, g: 0, b: 170, a: 1},
                cid: 'sensor2'
            }
        ]
    };

    await knex('panels').insert({
        id: 1,
        name: 'Duis eget',
        description: 'In ullamcorper fringilla enim tempus venenatis.',
        workspace: 1,
        order: 1,
        template: 1,
        params: JSON.stringify(params),
        namespace: 1
    });

    await knex('workspaces').where('id', 1).update({default_panel: 1});
})();